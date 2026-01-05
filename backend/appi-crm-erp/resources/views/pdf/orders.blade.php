

<!DOCTYPE html>
<html>
<head>
    <title>Orden de Pedido Creada</title>
</head>
<body>
    <h1>Orden de pedido Creada</h1>
    <p>Se ha creado una nueva Orden de pedido con los siguientes detalles:</p>
    <ul>
        <li><strong>Orde de Pedido:</strong> {{ $order->order_number }}</li>
        <li><strong>Fecha:</strong> {{ $order->date }}</li>
        <li><strong>Proveedor:</strong> {{ $order->provider->name ?? 'N/A' }}</li>
        <li><strong>Área solicitante:</strong> {{ $order->requesterArea->name ?? 'N/A' }}</li>
        <li><strong>Total:</strong> {{ $order->total }}</li>
        <li><strong>Productos:</strong>
            <ul>
                @foreach ($order->products as $product)
                    <li>{{ $product->description }} (Cantidad: {{ $product->quantity }})</li>
                @endforeach
            </ul>
        </li>
    </ul>
    <p>La OP ha sido enviada a Área 2 para su revisión.</p>
</body>
</html>
