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
    readonly FluxyChatOptions _options;
    static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };

    public FluxyChatClient(FluxyChatOptions options, HttpClient? http = null)
    {
        _options = options;
        _http = http ?? new HttpClient { BaseAddress = new Uri(options.BaseUrl.TrimEnd('/') + "/") };
        _http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", options.Token);
    }

    public void SetToken(string token) =>
        _http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

    public async Task<IReadOnlyList<FluxyRoom>> ListRoomsAsync(int limit = 25, CancellationToken ct = default)
    {
        var res = await _http.GetFromJsonAsync<RoomsResponse>($"rooms?limit={limit}", JsonOptions, ct);
        return res?.Rooms ?? Array.Empty<FluxyRoom>();
    }

    public async Task<IReadOnlyList<FluxyMessageDto>> ListMessagesAsync(string roomId, int limit = 50, CancellationToken ct = default)
    {
        var res = await _http.GetFromJsonAsync<MessagesResponse>(
            $"rooms/{Uri.EscapeDataString(roomId)}/messages?limit={limit}",
            JsonOptions,
            ct);
        return res?.Messages ?? Array.Empty<FluxyMessageDto>();
    }

    public async Task<FluxyMessageDto> SendMessageAsync(string roomId, string content, CancellationToken ct = default)
    {
        var res = await _http.PostAsJsonAsync(
            $"rooms/{Uri.EscapeDataString(roomId)}/messages",
            new { content },
            ct);
        res.EnsureSuccessStatusCode();
        var payload = await res.Content.ReadFromJsonAsync<SendMessageResponse>(JsonOptions, ct);
        return payload?.Message ?? throw new InvalidOperationException("empty_message_response");
    }

    public async Task<FluxyInboxSummary> GetInboxAsync(CancellationToken ct = default)
    {
        return await _http.GetFromJsonAsync<FluxyInboxSummary>("inbox", JsonOptions, ct)
            ?? new FluxyInboxSummary();
    }

    public async Task RegisterPushDeviceAsync(string platform, string token, CancellationToken ct = default)
    {
        var res = await _http.PostAsJsonAsync("push/devices", new { platform, token }, ct);
        res.EnsureSuccessStatusCode();
    }

    public void Dispose() => _http.Dispose();

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
