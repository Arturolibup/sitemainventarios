

<!DOCTYPE html>
<html>
<head>
    <title>Suficiencia Presupuestal Creada</title>
</head>
<body>
    <h1>Suficiencia Presupuestal Creada</h1>
    <p>Se ha creado una nueva suficiencia presupuestal con los siguientes detalles:</p>
    <ul>
        <li><strong>Folio:</strong> {{ $order->foliosf }}</li>
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
    <p>La suficiencia ha sido enviada a Área 2 para su revisión.</p>
</body>
</html>
