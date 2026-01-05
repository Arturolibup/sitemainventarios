<?php

return [
    'api_key' => env('OPENAI_API_KEY'),
    'agent_id' => env('OPENAI_AGENT_ID'),
    'base_url' => env('OPENAI_BASE_URL', 'https://api.openai.com/v1'),
];