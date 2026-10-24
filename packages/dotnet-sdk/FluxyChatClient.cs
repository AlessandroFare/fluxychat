using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace FluxyChat;

public sealed class FluxyChatOptions
{
    public required string BaseUrl { get; init; }
    public required string ProjectId { get; init; }
    public required string Token { get; init; }
}

public sealed class FluxyRoom
{
    [JsonPropertyName("id")] public string Id { get; set; } = "";
    [JsonPropertyName("name")] public string? Name { get; set; }
    [JsonPropertyName("type")] public string? Type { get; set; }
}

public sealed class FluxyMessageDto
{
    [JsonPropertyName("id")] public int Id { get; set; }
    [JsonPropertyName("roomId")] public string RoomId { get; set; } = "";
    [JsonPropertyName("userId")] public string UserId { get; set; } = "";
    [JsonPropertyName("content")] public string Content { get; set; } = "";
    [JsonPropertyName("createdAt")] public string? CreatedAt { get; set; }
}

public sealed class FluxyInboxSummary
{
    [JsonPropertyName("counts")] public Dictionary<string, int>? Counts { get; set; }
}

/// <summary>
/// Minimal .NET REST client (CP-065 skeleton).
/// </summary>
public sealed class FluxyChatClient : IDisposable
{
    readonly HttpClient _http;
    readonly bool _ownsHttp;
    readonly FluxyChatOptions _options;
    string _token;
    static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };

    public FluxyChatClient(FluxyChatOptions options, HttpClient? http = null)
    {
        _options = options;
        _ownsHttp = http is null;
        _http = http ?? new HttpClient { BaseAddress = new Uri(options.BaseUrl.TrimEnd('/') + "/") };
        _token = options.Token;
    }

    // Audit F-92: the Bearer token is attached per request. Writing it into
    // DefaultRequestHeaders leaked the token to every other holder of a shared
    // HttpClient and made SetToken affect them too.
    HttpRequestMessage Authed(HttpMethod method, string path)
    {
        var request = new HttpRequestMessage(method, path);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _token);
        return request;
    }

    public void SetToken(string token) => _token = token;

    public async Task<IReadOnlyList<FluxyRoom>> ListRoomsAsync(int limit = 25, CancellationToken ct = default)
    {
        using var req = Authed(HttpMethod.Get, $"rooms?limit={limit}");
        var res = await _http.SendAsync(req, ct);
        res.EnsureSuccessStatusCode();
        var payload = await res.Content.ReadFromJsonAsync<RoomsResponse>(JsonOptions, ct);
        return payload?.Rooms ?? Array.Empty<FluxyRoom>();
    }

    public async Task<IReadOnlyList<FluxyMessageDto>> ListMessagesAsync(string roomId, int limit = 50, CancellationToken ct = default)
    {
        using var req = Authed(
            HttpMethod.Get,
            $"rooms/{Uri.EscapeDataString(roomId)}/messages?limit={limit}");
        var res = await _http.SendAsync(req, ct);
        res.EnsureSuccessStatusCode();
        var payload = await res.Content.ReadFromJsonAsync<MessagesResponse>(JsonOptions, ct);
        return payload?.Messages ?? Array.Empty<FluxyMessageDto>();
    }

    public async Task<FluxyMessageDto> SendMessageAsync(string roomId, string content, CancellationToken ct = default)
    {
        using var req = Authed(HttpMethod.Post, $"rooms/{Uri.EscapeDataString(roomId)}/messages");
        req.Content = JsonContent.Create(new { content });
        var res = await _http.SendAsync(req, ct);
        res.EnsureSuccessStatusCode();
        var payload = await res.Content.ReadFromJsonAsync<SendMessageResponse>(JsonOptions, ct);
        return payload?.Message ?? throw new InvalidOperationException("empty_message_response");
    }

    public async Task<FluxyInboxSummary> GetInboxAsync(CancellationToken ct = default)
    {
        using var req = Authed(HttpMethod.Get, "inbox");
        var res = await _http.SendAsync(req, ct);
        res.EnsureSuccessStatusCode();
        return await res.Content.ReadFromJsonAsync<FluxyInboxSummary>(JsonOptions, ct)
            ?? new FluxyInboxSummary();
    }

    public async Task RegisterPushDeviceAsync(string platform, string token, CancellationToken ct = default)
    {
        using var req = Authed(HttpMethod.Post, "push/devices");
        req.Content = JsonContent.Create(new { platform, token });
        var res = await _http.SendAsync(req, ct);
        res.EnsureSuccessStatusCode();
    }

    /// <summary>Disposes the HttpClient only when this client created it (audit F-92).</summary>
    public void Dispose()
    {
        if (_ownsHttp)
        {
            _http.Dispose();
        }
    }

    sealed class RoomsResponse
    {
        [JsonPropertyName("rooms")] public List<FluxyRoom>? Rooms { get; set; }
    }

    sealed class MessagesResponse
    {
        [JsonPropertyName("messages")] public List<FluxyMessageDto>? Messages { get; set; }
    }

    sealed class SendMessageResponse
    {
        [JsonPropertyName("message")] public FluxyMessageDto? Message { get; set; }
    }
}
