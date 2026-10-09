using Microsoft.AspNetCore.Mvc.Testing;

namespace Portal.Tests;

public sealed class PortalHostTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient client;

    public PortalHostTests(WebApplicationFactory<Program> factory)
    {
        client = factory.CreateClient();
    }

    [Fact]
    public async Task GivenFrontendDeepLink_WhenRequested_ReturnsStarterShell()
    {
        using var response = await client.GetAsync("/tickets/TICKET-001");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var document = await response.Content.ReadAsStringAsync();
        Assert.Contains("<title>AgentGate Lab</title>", document);
        Assert.Contains("id=\"root\"", document);
    }

    [Theory]
    [InlineData("/bff", "GET")]
    [InlineData("/auth", "GET")]
    [InlineData("/api", "GET")]
    [InlineData("/bff/not-implemented", "GET")]
    [InlineData("/auth/not-implemented", "GET")]
    [InlineData("/api/not-implemented", "GET")]
    [InlineData("/bff/nested/not-implemented", "GET")]
    [InlineData("/auth/nested/not-implemented", "GET")]
    [InlineData("/api/nested/not-implemented", "GET")]
    [InlineData("/bff/not-implemented", "POST")]
    [InlineData("/auth/not-implemented", "POST")]
    [InlineData("/api/not-implemented", "POST")]
    public async Task GivenUnknownReservedRoute_WhenRequested_ReturnsProblemInsteadOfHtml(
        string path, string method)
    {
        using var request = new HttpRequestMessage(new HttpMethod(method), path);
        using var response = await client.SendAsync(request);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        var document = await response.Content.ReadAsStringAsync();
        Assert.DoesNotContain("<html", document, StringComparison.OrdinalIgnoreCase);
    }
}
