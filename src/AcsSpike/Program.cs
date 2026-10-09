using System.Runtime.InteropServices;
using System.Text.Json;
using AgentControlSpecification;

if (!OperatingSystem.IsLinux() || RuntimeInformation.ProcessArchitecture != Architecture.X64)
{
    Console.Error.WriteLine("The ACS spike container requires Linux x64.");
    return 1;
}

var fixtureDirectory = Path.Combine(AppContext.BaseDirectory, "Fixtures");
var manifestPath = Path.Combine(fixtureDirectory, "manifest.yaml");
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
var results = new List<FixtureResult>();
foreach (var fixture in new[]
{
    new TicketFixture("permitted-read", "tickets.read", true),
    new TicketFixture("unpermitted-read", "tickets.read", false),
    new TicketFixture("unknown-tool", "tickets.delete", true)
})
{
    results.Add(await RunFixtureAsync(control, fixture));
}

Console.WriteLine(JsonSerializer.Serialize(new
{
    runtime = $".NET {Environment.Version} on Linux x64",
    engine = "native-acs-opa",
    manifestValid = validation.Valid,
    fixtures = results
}, new JsonSerializerOptions(JsonSerializerDefaults.Web)));
return 0;

static async Task<FixtureResult> RunFixtureAsync(AgentControl control, TicketFixture fixture)
{
    var executions = 0;
    var args = new { ticketId = "SYN-001" };
    var snapshot = new Dictionary<string, object?>
    {
        ["task"] = new { ticketReadPermitted = fixture.Permitted }
    };
    try
    {
        var result = await control.RunToolAsync(
            fixture.ToolName,
            args,
            (_, _) =>
            {
                executions++;
                return ValueTask.FromResult(new { ticketId = "SYN-001", title = "Synthetic ticket" });
            },
            toolCallId: fixture.Name,
            snapshot: snapshot,
            mode: EnforcementMode.Enforce);
        return new FixtureResult(
            fixture.Name,
            result.PreToolCallResult.Verdict.Decision.ToWireName(),
            result.PreToolCallResult.Verdict.Reason,
            executions,
            result.PostToolCallResult.Verdict.Decision.ToWireName());
    }
    catch (AgentControlBlockedException exception)
    {
        return new FixtureResult(
            fixture.Name,
            exception.Result.Verdict.Decision.ToWireName(),
            exception.Result.Verdict.Reason,
            executions,
            null);
    }
}

internal sealed record TicketFixture(string Name, string ToolName, bool Permitted);
internal sealed record FixtureResult(
    string Name, string Decision, string? Reason, int DelegateExecutions, string? PostToolDecision);
