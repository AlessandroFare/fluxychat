using System;
using System.Net.Http;
using System.Net.WebSockets;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using UnityEngine;

namespace FluxyChat
{
    [Serializable]
    public class FluxyChatConfig
    {
        public string ApiUrl;
        public string WsUrl;
        public string ProjectId;
        public string Token;
    }

    [Serializable]
    public class FluxyMessage
    {
        public int id;
        public string roomId;
        public string userId;
        public string content;
        public string createdAt;
    }

    /// <summary>
    /// Minimal Unity client — REST send + WebSocket receive.
    /// </summary>
    public class FluxyChatClient : IDisposable
    {
        readonly FluxyChatConfig _config;
        readonly HttpClient _http = new HttpClient();
        ClientWebSocket _ws;
        CancellationTokenSource _cts;

        public event Action<FluxyMessage> OnMessage;
        public event Action<string> OnConnectionState;

        public FluxyChatClient(FluxyChatConfig config)
        {
            _config = config ?? throw new ArgumentNullException(nameof(config));
        }

        public void SetToken(string token) => _config.Token = token;

        public async Task ConnectRoomAsync(string roomId)
        {
            DisconnectRoom();
            _cts = new CancellationTokenSource();
            _ws = new ClientWebSocket();
            _ws.Options.SetRequestHeader("Authorization", "Bearer " + _config.Token);
            var uri = new Uri($"{_config.WsUrl.TrimEnd('/')}/rooms/{Uri.EscapeDataString(roomId)}/ws?projectId={Uri.EscapeDataString(_config.ProjectId)}");
            await _ws.ConnectAsync(uri, _cts.Token);
            OnConnectionState?.Invoke("connected");
            _ = ReceiveLoop(_cts.Token);
        }

        public void DisconnectRoom()
        {
            _cts?.Cancel();
            _ws?.Dispose();
            _ws = null;
            OnConnectionState?.Invoke("disconnected");
        }

        public async Task SendMessageAsync(string roomId, string content, string clientMessageId = null)
        {
            var url = $"{_config.ApiUrl.TrimEnd('/')}/rooms/{Uri.EscapeDataString(roomId)}/messages";
            var body = clientMessageId != null
                ? $"{{\"content\":{JsonQuote(content)},\"clientMessageId\":{JsonQuote(clientMessageId)}}}"
                : $"{{\"content\":{JsonQuote(content)}}}";
            using var req = new HttpRequestMessage(HttpMethod.Post, url);
            req.Headers.Add("Authorization", "Bearer " + _config.Token);
            req.Content = new StringContent(body, Encoding.UTF8, "application/json");
            var res = await _http.SendAsync(req);
            res.EnsureSuccessStatusCode();
        }

        async Task ReceiveLoop(CancellationToken ct)
        {
            var buffer = new ArraySegment<byte>(new byte[8192]);
            while (_ws != null && _ws.State == WebSocketState.Open && !ct.IsCancellationRequested)
            {
                var result = await _ws.ReceiveAsync(buffer, ct);
                if (result.MessageType == WebSocketMessageType.Close) break;
                var json = Encoding.UTF8.GetString(buffer.Array, 0, result.Count);
                var msg = JsonUtility.FromJson<FluxyMessage>(json);
                if (msg != null && msg.id > 0) OnMessage?.Invoke(msg);
            }
        }

        static string JsonQuote(string s) => "\"" + (s ?? "").Replace("\\", "\\\\").Replace("\"", "\\\"") + "\"";

        public void Dispose()
        {
            DisconnectRoom();
            _http.Dispose();
        }
    }
}
