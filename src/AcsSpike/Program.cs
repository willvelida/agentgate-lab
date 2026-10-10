using System.Runtime.InteropServices;
using System.Text.Json;
using AgentControlSpecification;

if (!OperatingSystem.IsLinux() || RuntimeInformation.ProcessArchitecture != Architecture.X64)
{
    Console.Error.WriteLine("The ACS spike container requires Linux x64.");
    return 1;
}

var fixtureDirectory = Path.Combine(AppContext.BaseDirectory, "Fixtures");
var failureFixture = args.Length == 2 && args[0] == "--failure-fixture" ? args[1] : null;
if (args.Length != 0 && failureFixture is not
    ("malformed-manifest" or "missing-task" or "missing-permission" or
     "missing-native-payload" or "unavailable-opa" or "policy-evaluation-error"))
{
    Console.Error.WriteLine("Use no arguments or --failure-fixture with a documented fixture name.");
    return 1;
}
var manifestPath = failureFixture switch
{
    "malformed-manifest" => Path.Combine(fixtureDirectory, "failures", "malformed.yaml"),
    "policy-evaluation-error" => Path.Combine(fixtureDirectory, "failures", "undefined-query.yaml"),
    _ => Path.Combine(fixtureDirectory, "manifest.yaml")
};
var policyPath = Path.Combine(fixtureDirectory, "policy", "ticket-read.rego");
var validation = ArtifactValidator.Validate(
    File.ReadAllText(manifestPath),
    new Dictionary<string, string> { ["ticket-read.rego"] = File.ReadAllText(policyPath) });
if (!validation.Valid)
{
    Console.Error.WriteLine(JsonSerializer.Serialize(validation));
    return 1;
}

var control = AgentControl.FromPath(manifestPath);
if (failureFixture is not null)
{
    var failureResult = await RunFixtureAsync(
        control, new TicketFixture(failureFixture, "tickets.read", true),
        failureFixture);
    Console.WriteLine(JsonSerializer.Serialize(failureResult,
        new JsonSerializerOptions(JsonSerializerDefaults.Web)));
    return 0;
}
var results = new List<FixtureResult>();
var ticketFixtures = new[]
{
    new TicketFixture("permitted-read", "tickets.read", true),
    new TicketFixture("unpermitted-read", "tickets.read", false),
    new TicketFixture("unknown-tool", "tickets.delete", true)
};
foreach (var fixture in ticketFixtures)
{
    results.Add(await RunFixtureAsync(control, fixture));
}

var determinism = new List<DeterminismResult>();
foreach (var fixture in ticketFixtures.Append(
    new TicketFixture("normalized-read", "tickets.read", true, "syn-001")))
{
    var attempts = new List<FixtureResult>();
    for (var attempt = 0; attempt < 3; attempt++)
    {
        var freshControl = AgentControl.FromPath(manifestPath);
        attempts.Add(await RunFixtureAsync(freshControl, fixture));
    }
    determinism.Add(new DeterminismResult(fixture.Name, attempts));
}

Console.WriteLine(JsonSerializer.Serialize(new
{
    runtime = $".NET {Environment.Version} on Linux x64",
    engine = "native-acs-opa",
    manifestValid = validation.Valid,
    fixtures = results,
    determinism
}, new JsonSerializerOptions(JsonSerializerDefaults.Web)));
return 0;

static async Task<FixtureResult> RunFixtureAsync(
    AgentControl control, TicketFixture fixture, string? failureFixture = null)
{
    var executions = 0;
    var args = new { ticketId = fixture.TicketId };
    string? delegateTicketId = null;
    var snapshot = new Dictionary<string, object?>
    {
        ["task"] = new { ticketReadPermitted = fixture.Permitted }
    };
    if (failureFixture == "missing-task")
    {
        snapshot.Remove("task");
    }
    else if (failureFixture == "missing-permission")
    {
        snapshot["task"] = new { };
    }
    try
    {
        var result = await control.RunToolAsync(
            fixture.ToolName,
            args,
            (effectiveArgs, _) =>
            {
                executions++;
                if (failureFixture is not null)
                {
                    Console.Error.WriteLine("ACS_SPIKE_DELEGATE_EXECUTED");
                }
                delegateTicketId = effectiveArgs.ticketId;
                return ValueTask.FromResult(new { ticketId = effectiveArgs.ticketId, title = "Synthetic ticket" });
            },
            toolCallId: fixture.Name,
            snapshot: snapshot,
            mode: EnforcementMode.Enforce);
        return new FixtureResult(
            fixture.Name,
            result.PreToolCallResult.Verdict.Decision.ToWireName(),
            result.PreToolCallResult.Verdict.Reason,
            executions,
            result.PostToolCallResult.Verdict.Decision.ToWireName(),
            EvaluationResult.FromNative(result.PreToolCallResult),
            EvaluationResult.FromNative(result.PostToolCallResult),
            delegateTicketId);
    }
    catch (AgentControlBlockedException exception)
    {
        return new FixtureResult(
            fixture.Name,
            exception.Result.Verdict.Decision.ToWireName(),
            exception.Result.Verdict.Reason,
            executions,
            null,
            EvaluationResult.FromNative(exception.Result),
            null,
            delegateTicketId);
    }
}

internal sealed record TicketFixture(
    string Name, string ToolName, bool Permitted, string TicketId = "SYN-001");
internal sealed record FixtureResult(
    string Name, string Decision, string? Reason, int DelegateExecutions, string? PostToolDecision,
    EvaluationResult PreToolEvaluation, EvaluationResult? PostToolEvaluation, string? DelegateTicketId);
internal sealed record DeterminismResult(string Name, IReadOnlyList<FixtureResult> Attempts);
internal sealed record EvaluationResult(
    string Decision, string? Reason, string? ActionIdentity,
    JsonElement? TransformedPolicyTarget, bool TransformedPolicyTargetApplied)
{
    internal static EvaluationResult FromNative(InterventionPointResult result) => new(
        result.Verdict.Decision.ToWireName(),
        result.Verdict.Reason,
        result.ActionIdentity,
        result.TransformedPolicyTarget,
        result.TransformedPolicyTargetApplied);
}
