using System.Diagnostics;
using System.Text.Json;

namespace AcsSpike.Tests;

public sealed class NativeTicketReadTests(SpikeContainerFixture container) : IClassFixture<SpikeContainerFixture>
{
    [Theory]
    [InlineData("unpermitted-read", "ticket_read_not_permitted")]
    [InlineData("unknown-tool", "runtime_error:tool_unknown")]
    public void GivenDeniedFixture_WhenGuardedToolRuns_DelegateIsNotExecuted(string name, string reason)
    {
        var fixture = container.Result.GetProperty("fixtures").EnumerateArray()
            .Single(value => value.GetProperty("name").GetString() == name);

        Assert.Equal("deny", fixture.GetProperty("decision").GetString());
        Assert.Equal(reason, fixture.GetProperty("reason").GetString());
        Assert.Equal(0, fixture.GetProperty("delegateExecutions").GetInt32());
        Assert.Equal(JsonValueKind.Null, fixture.GetProperty("postToolDecision").ValueKind);
    }

    [Fact]
    public void GivenPermittedRead_WhenGuardedToolRuns_DelegateExecutesOnce()
    {
        var fixture = container.Result.GetProperty("fixtures").EnumerateArray()
            .Single(value => value.GetProperty("name").GetString() == "permitted-read");

        Assert.Equal("allow", fixture.GetProperty("decision").GetString());
        Assert.Equal("ticket_read_permitted", fixture.GetProperty("reason").GetString());
        Assert.Equal(1, fixture.GetProperty("delegateExecutions").GetInt32());
        Assert.Equal("allow", fixture.GetProperty("postToolDecision").GetString());
    }

    [Fact]
    public void GivenPinnedArtifacts_WhenContainerStarts_NativeManifestValidationSucceeds()
    {
        Assert.Equal("native-acs-opa", container.Result.GetProperty("engine").GetString());
        Assert.True(container.Result.GetProperty("manifestValid").GetBoolean());
        Assert.Contains("Linux x64", container.Result.GetProperty("runtime").GetString());
        Assert.Equal(3, container.Result.GetProperty("fixtures").GetArrayLength());
        Assert.Equal(4, container.Result.GetProperty("determinism").GetArrayLength());
    }

    [Theory]
    [InlineData("permitted-read", "allow", "ticket_read_permitted")]
    [InlineData("unpermitted-read", "deny", "ticket_read_not_permitted")]
    [InlineData("unknown-tool", "deny", "runtime_error:tool_unknown")]
    [InlineData("normalized-read", "transform", "ticket_id_normalized")]
    public void GivenIdenticalInputs_WhenNativeRuntimeReloads_StableResultsMatch(
        string name, string decision, string reason)
    {
        var attempts = container.Result.GetProperty("determinism").EnumerateArray()
            .Single(value => value.GetProperty("name").GetString() == name)
            .GetProperty("attempts").EnumerateArray().ToArray();
        Assert.Equal(3, attempts.Length);

        var expected = attempts[0];
        Assert.Equal(decision, expected.GetProperty("decision").GetString());
        Assert.Equal(reason, expected.GetProperty("reason").GetString());
        foreach (var attempt in attempts)
        {
            Assert.True(JsonElement.DeepEquals(expected, attempt),
                $"Stable native result changed for {name}.\nExpected: {expected}\nActual: {attempt}");
            var preTool = attempt.GetProperty("preToolEvaluation");
            Assert.Equal(decision, preTool.GetProperty("decision").GetString());
            Assert.Equal(reason, preTool.GetProperty("reason").GetString());
            if (name != "unknown-tool")
            {
                Assert.False(string.IsNullOrWhiteSpace(preTool.GetProperty("actionIdentity").GetString()));
            }
            if (decision == "deny")
            {
                Assert.Equal(0, attempt.GetProperty("delegateExecutions").GetInt32());
                Assert.Equal(JsonValueKind.Null, attempt.GetProperty("postToolEvaluation").ValueKind);
                Assert.False(preTool.GetProperty("transformedPolicyTargetApplied").GetBoolean());
                Assert.Equal(JsonValueKind.Null, preTool.GetProperty("transformedPolicyTarget").ValueKind);
            }
            else
            {
                Assert.Equal(1, attempt.GetProperty("delegateExecutions").GetInt32());
                var postTool = attempt.GetProperty("postToolEvaluation");
                Assert.Equal("allow", postTool.GetProperty("decision").GetString());
                Assert.Equal("synthetic_ticket_result", postTool.GetProperty("reason").GetString());
                Assert.False(string.IsNullOrWhiteSpace(postTool.GetProperty("actionIdentity").GetString()));
            }
        }
    }

    [Fact]
    public void GivenLowercaseTicketId_WhenNativeTransformRuns_DelegateReceivesTransformedTarget()
    {
        var attempts = container.Result.GetProperty("determinism").EnumerateArray()
            .Single(value => value.GetProperty("name").GetString() == "normalized-read")
            .GetProperty("attempts");
        foreach (var attempt in attempts.EnumerateArray())
        {
            var preTool = attempt.GetProperty("preToolEvaluation");
            Assert.True(preTool.GetProperty("transformedPolicyTargetApplied").GetBoolean());
            var target = preTool.GetProperty("transformedPolicyTarget");
            Assert.Single(target.EnumerateObject());
            Assert.Equal("SYN-001", target.GetProperty("ticketId").GetString());
            Assert.Equal("SYN-001", attempt.GetProperty("delegateTicketId").GetString());
            Assert.Equal(1, attempt.GetProperty("delegateExecutions").GetInt32());
        }
    }
}

public sealed class SpikeContainerFixture : IAsyncLifetime
{
    private readonly string _containerName = $"agentgate-f003-{Guid.NewGuid():N}";

    public JsonElement Result { get; private set; }

    public async Task InitializeAsync()
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory is not null && !File.Exists(Path.Combine(directory.FullName, "AgentGateLab.sln")))
        {
            directory = directory.Parent;
        }
        Assert.NotNull(directory);

        var startInfo = new ProcessStartInfo("docker")
        {
            WorkingDirectory = directory.FullName,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false
        };
        foreach (var argument in new[]
        {
            "compose", "run", "--build", "--rm", "--no-deps", "--name", _containerName, "acs-spike"
        })
        {
            startInfo.ArgumentList.Add(argument);
        }
        using var process = Process.Start(startInfo)
            ?? throw new InvalidOperationException("Could not start the Linux ACS container.");
        var stdout = process.StandardOutput.ReadToEndAsync();
        var stderr = process.StandardError.ReadToEndAsync();
        using var timeout = new CancellationTokenSource(TimeSpan.FromMinutes(10));
        try
        {
            await process.WaitForExitAsync(timeout.Token);
        }
        catch (OperationCanceledException)
        {
            process.Kill(entireProcessTree: true);
            throw new TimeoutException("The Linux ACS container did not complete within ten minutes.");
        }
        var output = await stdout;
        var errors = await stderr;
        Assert.True(process.ExitCode == 0, $"Linux ACS container exited {process.ExitCode}.\n{output}\n{errors}");
        var resultLine = output.Split('\n', StringSplitOptions.RemoveEmptyEntries)
            .Last(line => line.TrimStart().StartsWith('{'));
        using var document = JsonDocument.Parse(resultLine);
        Result = document.RootElement.Clone();
    }

    public async Task DisposeAsync()
    {
        var startInfo = new ProcessStartInfo("docker")
        {
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false
        };
        startInfo.ArgumentList.Add("container");
        startInfo.ArgumentList.Add("ls");
        startInfo.ArgumentList.Add("--all");
        startInfo.ArgumentList.Add("--filter");
        startInfo.ArgumentList.Add($"name=^/{_containerName}$");
        startInfo.ArgumentList.Add("--quiet");
        using var inspect = Process.Start(startInfo)
            ?? throw new InvalidOperationException("Could not inspect the test container for cleanup.");
        var stdout = inspect.StandardOutput.ReadToEndAsync();
        var stderr = inspect.StandardError.ReadToEndAsync();
        await inspect.WaitForExitAsync();
        Assert.True(inspect.ExitCode == 0, await stderr);
        if (string.IsNullOrWhiteSpace(await stdout))
        {
            return;
        }

        startInfo.ArgumentList.Clear();
        foreach (var argument in new[] { "container", "rm", "--force", _containerName })
        {
            startInfo.ArgumentList.Add(argument);
        }
        using var cleanup = Process.Start(startInfo)
            ?? throw new InvalidOperationException("Could not remove the owned ACS test container.");
        var cleanupOutput = cleanup.StandardOutput.ReadToEndAsync();
        var cleanupErrors = cleanup.StandardError.ReadToEndAsync();
        await cleanup.WaitForExitAsync();
        Assert.True(cleanup.ExitCode == 0, $"{await cleanupOutput}\n{await cleanupErrors}");
    }
}
