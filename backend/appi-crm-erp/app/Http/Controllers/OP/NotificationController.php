<?php

namespace App\Http\Controllers\OP;

use Illuminate\Http\Request;
use App\Models\OP\Notification;
use App\Http\Controllers\Controller;

class NotificationController extends Controller
{
    public function store(Request $request)
{
    $validated = $request->validate([
        'user_id' => 'required|exists:users,id',
        'order_request_id' => 'required|exists:order_requests,id',
        'message' => 'required|string',
        'type' => 'nullable|string|in:info,success,error,warning',
        ]);
        $validated['is_read'] = false;

    $notification = Notification::create($validated);
    return response()->json(['data' => $notification, 'message' => 'Notificación creada exitosamente']);
}

public function dismiss($id)
{
    $notification = Notification::findOrFail($id);
    $notification->update(['is_read' => true]);
    return response()->json(['data' => $notification, 'message' => 'Notificación cerrada']);
}

public function index(Request $request)
{
    $query = Notification::query();
    if ($request->filled('order_request_id')) {
        $query->where('order_request_id', $request->input('order_request_id'));
    }
    $notifications = $query->with('orderRequest')->get();
    return response()->json(['data' => $notifications, 'message' => 'Notificaciones cargadas']);
}

public function markAsRead($id)
{
    $notification = Notification::findOrFail($id);
    $notification->update(['is_read' => true]);
    return response()->json(['data' => $notification, 'message' => 'Notificación marcada como leída']);
}

}
