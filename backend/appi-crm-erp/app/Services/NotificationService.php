<?php

namespace App\Services;

use App\Models\OP\Notification;
use Illuminate\Support\Facades\Http;

class NotificationService
{
    public static function send(array $data): Notification
    {
        // 1️⃣ Guardar en DB
        $notification = Notification::create([
            'user_id' => $data['user_id'],
            'order_request_id' => $data['order_request_id'] ?? null,
            'message' => $data['message'],
            'type' => $data['type'] ?? 'info',
            'is_read' => false,
        ]);

        // 2️⃣ Emitir WS (dirigido)
        Http::withHeaders([
            'x-ws-key' => config('services.ws.key'),
        ])->post(config('services.ws.url') . '/send-notification', [
            'user_id' => $data['user_id'],
            'message' => $data['message'],
            'type' => $data['type'] ?? 'info',
            'module' => 'orden_pedido',
        ]);

        return $notification;
    }
}
