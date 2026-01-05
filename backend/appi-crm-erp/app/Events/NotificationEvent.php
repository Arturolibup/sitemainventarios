<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class NotificationEvent implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $notification;

    public function __construct($notification)
    {
        $this->notification = $notification;
    }

    public function broadcastOn()
    {
        return new Channel('notifications');
    }

    public function broadcastWith()
    {
        return [
            'title' => $this->notification['title'] ?? '',
            'message' => $this->notification['message'] ?? '',
            'type' => $this->notification['type'] ?? 'info',
            'user_id' => $this->notification['user_id'] ?? null,
            'timestamp' => now()->toDateTimeString(),
            'module' => $this->notification['module'] ?? 'system'
        ];
    }

    public function broadcastAs()
    {
        return 'notification.event';
    }
}