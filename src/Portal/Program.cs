var builder = WebApplication.CreateBuilder(args);
builder.Services.AddProblemDetails();

var app = builder.Build();

app.UseDefaultFiles();
app.UseStaticFiles();

app.MapGet("/health", () => Results.Ok(new { status = "ok", service = "portal" }));

MapReservedRoute("/bff");
MapReservedRoute("/auth");
MapReservedRoute("/api");

app.MapFallback(async context =>
{
    if (!HttpMethods.IsGet(context.Request.Method) &&
        !HttpMethods.IsHead(context.Request.Method))
    {
        await Results.Problem(
            statusCode: StatusCodes.Status404NotFound,
            title: "Route not found").ExecuteAsync(context);
        return;
    }

    context.Response.ContentType = "text/html; charset=utf-8";
    await context.Response.SendFileAsync(
        Path.Combine(app.Environment.WebRootPath ?? "wwwroot", "index.html"));
});

app.Run();

void MapReservedRoute(string prefix)
{
    app.Map(prefix + "/{**path}", () => Results.Problem(
        statusCode: StatusCodes.Status404NotFound,
        title: "Route not found"));
}

public partial class Program
{
}
