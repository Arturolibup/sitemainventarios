<?php

namespace App\Services;

use Exception;
use GuzzleHttp\Client;
use Illuminate\Support\Facades\Log;

class SocketService
{
    public static function sendNotification($data)
    {
        try {
            $client = new Client();
            $response = $client->post('http://localhost:3000/send-notification', [
                'json' => $data,
                'timeout' => 3, // 3 segundos de timeout
                'headers' => [
                    'Content-Type' => 'application/json',
                ],
                'verify' => false,
            ]);
            
            return $response->getStatusCode() === 200;
        } catch (Exception $e) {
            // Si falla, no rompe la aplicación
            Log::error('Error sending socket notification: ' . $e->getMessage());
            return false;
        }
    }
}