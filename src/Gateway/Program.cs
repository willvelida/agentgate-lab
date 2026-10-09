var builder = WebApplication.CreateBuilder(args);
builder.Services.AddProblemDetails();

var app = builder.Build();

app.MapGet("/health", () => Results.Ok(new { status = "ok", service = "gateway" }));
app.MapGet("/", () => Results.Ok(new
{
    service = "gateway",
    status = "foundation-only",
    message = "Authorization and ticket operations are not implemented yet."
}));

app.Run();
