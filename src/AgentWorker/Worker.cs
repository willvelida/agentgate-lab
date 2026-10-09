namespace AgentWorker;

public class Worker(ILogger<Worker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        logger.LogInformation(
            "Agent Worker foundation is running; agent execution is not implemented yet.");

        while (!stoppingToken.IsCancellationRequested)
        {
            await Task.Delay(Timeout.Infinite, stoppingToken);
        }
    }
}
