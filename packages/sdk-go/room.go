// Package fluxychat is a hand-written WebSocket helper. REST clients belong in generated/.
package fluxychat

import (
	"fmt"
	"net/url"
	"strings"
)

// RoomWebSocketURL joins GET /ws/room/:id. OpenAPI Generator cannot emit this.
func RoomWebSocketURL(workerURL, token, roomID string) string {
	base := strings.TrimRight(workerURL, "/")
	base = strings.Replace(base, "https://", "wss://", 1)
	base = strings.Replace(base, "http://", "ws://", 1)
	// Audit F-92: escape both values — tokens contain '+', '/' and '=' which
	// break the query string when pasted in raw.
	return fmt.Sprintf("%s/ws/room/%s?token=%s", base, url.PathEscape(roomID), url.QueryEscape(token))
}
