<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Orden de Pedido - {{ $order->order_number ?? '' }}</title>
  <style>
    @page { margin: .5cm; size: letter landscape; }
    body { font-family: Arial, sans-serif; font-size: 9px; margin: 0; padding: 0; color: #000; }

    .text-center { text-align: center; }
    .text-right  { text-align: right; }
    .text-left   { text-align: left; }
    .mb-8 { margin-bottom: 8px; }

    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #000; padding: 3px; font-size: 9px; }
    th { background: #e6e6e6; font-weight: bold; text-align: center; word-wrap: break-word; white-space: normal; }

    .header-table { width: 100%; margin-bottom: 8px; border: none; }
    .header-table td { border: none; padding: 0; background: transparent; vertical-align: top; }
    .logo-cell { width: 20%; }
    .titles-cell { width: 45%; }
    .boxes-cell  { width: 35%; }
    .logo-img { width: 3cm; height: 2.5cm; }
    .titles-wrap { text-align: center; }
    .titles-wrap p { margin: 2px 0; text-transform: uppercase; }

    .boxes-outer { width: 100%; border: none; }
    .boxes-outer td { border: none; padding: 0 0 0 6px; }
    .box-wrap { width: 100%; border-collapse: collapse; }
    .box-wrap th, .box-wrap td { border: 1px solid #000; font-size: 9px; padding: 2px; }
    .box-wrap th { background: #e6e6e6; text-align: center; }

    .products-table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }
    .products-table th, .products-table td {
      font-size: 7.5px;
      vertical-align: middle;
      padding: 3px;
      word-wrap: break-word;
      overflow-wrap: anywhere;   /* ← ayuda con palabras largas */
      white-space: normal;
    }

    .final-table td, .final-table th { padding: 4px; }
  </style>
</head>
<body>

@php
        // OBTENER SOLO EL JEFE DE MATERIALES
        use App\Models\Signatory\Signatory;
        
        $jefeMateriales = Signatory::where('is_active', true)
            ->where(function($q) {
                $q->where('departament', 'like', '%materiales%')
                  ->orWhere('position', 'like', '%jefe%materiales%');
            })
            ->orderBy('order')
            ->first();
@endphp

@php
  $isRefacciones = (($order->format_type ?? '') === 'REFACCIONES');

  // ====== Ajusta estos % (DEBEN SUMAR 100) ======
  if (!$isRefacciones) {
      // GENERAL (13 columnas)
      $W = [
        'no' => 2,
        'oficio' => 6,
        'ur' => 3,
        'gpo' => 3,
        'subgrupo' => 3,
        'progresivo' => 4,
        'cant' => 4,
        'udm' => 4,
        'desc' => 42,   // fijo
        'marca' => 5,
        'punit' => 9,   // fijo
        'partida' => 5,
        'importe' => 10 // fijo
      ];
  } else {
      // REFACCIONES (18 columnas)
      $W = [
        'no' => 2,
        'oficio' => 5.5,
        'placa' => 6,
        'marca_veh' => 5,
        'tipo' => 5,
        'modelo' => 4,
        'cilindros' => 3,
        'ur' => 3,
        'gpo' => 3,
        'subgrupo' => 3,
        'progresivo' => 3.5,
        'cant' => 4,
        'udm' => 4,
        'desc' => 28,   // fijo
        'marca' => 4,
        'punit' => 6,   // fijo
        'partida' => 5,
        'importe' => 6  // fijo
      ];
  }
@endphp

<!-- ENCABEZADO -->
<table class="header-table">
  <tr>
    <td class="logo-cell">
      @if(file_exists(public_path('/logfis.png')))
        <img class="logo-img" src="{{ public_path('logfis.png') }}" alt="Logo">
      @else
        <div class="mb-6">[LOGO]</div>
      @endif
    </td>

    <td class="titles-cell">
      <div class="titles-wrap">
        <p style="font-size:13px; font-weight:bold;">FISCALÍA GENERAL DEL ESTADO DE NAYARIT</p>
        <p style="font-size:11px;">DIRECCIÓN GENERAL DE ADMINISTRACIÓN</p>
        <p style="font-size:10px;">DEPARTAMENTO DE RECURSOS MATERIALES</p>
        <p style="font-size:11px;">FORMATO ÚNICO SOLICITUD DE BIEN Y/O SERVICIO</p>
        <p style="font-size:12px; font-weight:bold;">ORDEN DE PEDIDO</p>
      </div>
    </td>

    <td class="boxes-cell">
      <table class="boxes-outer">
        <tr>
          <td style="width:50%; padding-left:0;">
            <table class="box-wrap">
              <tr>
                <td><strong>ORDEN PEDIDO</strong></td>
                <td>{{ $order->order_number ?? '---' }}</td>
              </tr>
              <tr>
                <td><strong>FECHA</strong></td>
                <td>{{ $order->date ? \Carbon\Carbon::parse($order->date)->format('d/m/Y') : '---' }}</td>
              </tr>
              <tr>
                <td><strong>FECHA LÍMITE</strong></td>
                <td>{{ $order->date_limited ? \Carbon\Carbon::parse($order->date_limited)->format('d/m/Y') : '---' }}</td>
              </tr>
              <tr>
                <td><strong>ELABORÓ</strong></td>
                <td>{{ optional($order->createdBy)->name ?? '---' }}</td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>

<!-- =============== DATOS GENERALES =============== -->
<table class="info-table mb-8">
  <tr>
    <td colspan="2"><strong>PROVEEDOR:</strong> {{ optional($order->provider)->full_name ?? '---' }}</td>
    <td class="nowrap"><strong>No. Beneficiarios:</strong> {{ $order->no_beneficiarios ?? '---' }}</td>
  </tr>
  <tr>
    <td colspan="2"><strong>LUGAR DE ENTREGA:</strong> {{ $order->delivery_place ?? '---' }}</td>
    <td class="nowrap">
      <strong>UR:</strong>
      {{ optional(optional($order->requesterSubarea)->area)->urs ?? ($order->ur ?? '---') }}
      @php $areaName = optional(optional($order->requesterSubarea)->area)->name; @endphp
      @if($areaName) - {{ $areaName }} @endif
    </td>
  </tr>
</table>

<!-- =============== PRODUCTOS =============== -->
<!-- PRODUCTOS -->
<table class="products-table mb-8">
  <thead>
    <tr>
      <th style="width:{{ $W['no'] }}%;">No.</th>
      <th style="width:{{ $W['oficio'] }}%;">Oficio Origen</th>
      @if($isRefacciones)
        <th style="width:{{ $W['placa'] }}%;">Placa</th>
        <th style="width:{{ $W['marca_veh'] }}%;">Marca Veh.</th>
        <th style="width:{{ $W['tipo'] }}%;">Tipo</th>
        <th style="width:{{ $W['modelo'] }}%;">Modelo</th>
        <th style="width:{{ $W['cilindros'] }}%;">Cil.</th>
      @endif
      <th style="width:{{ $W['ur'] }}%;">UR</th>
      <th style="width:{{ $W['gpo'] }}%;">Gpo</th>
      <th style="width:{{ $W['subgrupo'] }}%;">Sub- grupo</th>
      <th style="width:{{ $W['progresivo'] }}%;">No. Prog.</th>
      <th style="width:{{ $W['cant'] }}%;">Cant.</th>
      <th style="width:{{ $W['udm'] }}%;">U. de M.</th>
      <th style="width:{{ $W['desc'] }}%;">Descripción</th>
      <th style="width:{{ $W['marca'] }}%;">Marca</th>
      <th style="width:{{ $W['punit'] }}%;">P. Unit.</th>
      <th style="width:{{ $W['partida'] }}%;">Partida</th>
      <th style="width:{{ $W['importe'] }}%;">Importe</th>
    </tr>
  </thead>
  <tbody>
    @foreach($order->products as $i => $p)
      @php
        $unitName = $p->unit_name ?? optional($p->unit)->name ?? '';
        $marcaVeh = $p->marca ?->nombre ?? '';
        $tipoVeh  = $p->tipo ?->nombre ?? '';
        $importe  = ((float)($p->quantity ?? 0)) * ((float)($p->unit_price ?? 0));
      @endphp
      <tr>
        <td class="text-center" style="width:{{ $W['no'] }}%;">{{ $i + 1 }}</td>
        <td class="text-center" style="width:{{ $W['oficio'] }}%;">{{ $p->oficio_origen ?? $p->oficio ?? $order->oficio_origen ?? $order->oficio ?? '' }}</td>

        @if($isRefacciones)
          <td class="text-center" style="width:{{ $W['placa'] }}%;">{{ $p->placa ?? '' }}</td>
          <td class="text-center" style="width:{{ $W['marca_veh'] }}%;">{{ $marcaVeh }}</td>
          <td class="text-center" style="width:{{ $W['tipo'] }}%;">{{ $tipoVeh }}</td>
          <td class="text-center" style="width:{{ $W['modelo'] }}%;">{{ $p->modelo ?? '' }}</td>
          <td class="text-center" style="width:{{ $W['cilindros'] }}%;">{{ $p->cilindro ?? '' }}</td>
        @endif

        <td class="text-center" style="width:{{ $W['ur'] }}%;">{{ $p->ur_progressive ?? $order->ur ?? '' }}</td>
        <td class="text-center" style="width:{{ $W['gpo'] }}%;">{{ $p->grupo ?? '' }}</td>
        <td class="text-center" style="width:{{ $W['subgrupo'] }}%;">{{ $p->subgrupo ?? '' }}</td>
        <td class="text-center" style="width:{{ $W['progresivo'] }}%;">{{ $p->progresivo ?? '' }}</td>
        <td class="text-center" style="width:{{ $W['cant'] }}%;">{{ $p->quantity ?? '' }}</td>
        <td class="text-center" style="width:{{ $W['udm'] }}%;">{{ $unitName }}</td>
        <td class="text-left"   style="width:{{ $W['desc'] }}%;">{{ $p->description ?? '' }}</td>
        <td class="text-center" style="width:{{ $W['marca'] }}%;">{{ $p->brand ?? '' }}</td>
        <td class="text-right"  style="width:{{ $W['punit'] }}%;">${{ number_format((float)($p->unit_price ?? 0), 2) }}</td>
        <td class="text-center" style="width:{{ $W['partida'] }}%;">{{ $p->partida ?? '' }}</td>
        <td class="text-right"  style="width:{{ $W['importe'] }}%;">${{ number_format($importe, 2) }}</td>
      </tr>
    @endforeach
  </tbody>
</table>

<!-- =============== FIRMAS Y TOTALES =============== -->
<table class="final-table">
  <colgroup>
    <col style="width:40%;">
    <col style="width:25%;">
    <col style="width:25%;">
    <col style="width:10%;">
  </colgroup>

  <tr>
    <td class="text-center" rowspan="3">
      <div style="min-height: 100px;">
        <div style="margin-bottom:4px;font-size:9px;">Revisó y Autorizó</div>
        
        <div style="height:60px;"></div>
        <div style="border-top:1px solid #000; width:90%; margin:0 auto 2px auto;"></div>
        @if($jefeMateriales)
          <div style="font-weight:bold; font-size:9px;">
            {{ $jefeMateriales->title ? $jefeMateriales->title . '. ' : '' }}{{ $jefeMateriales->name }}
          </div>
          <div style="font-size:8px;">{{ $jefeMateriales->position }}</div>
        @else
          <div class="firmante-faltante">¡CONFIGURAR FIRMANTE!</div>
          <div style="font-size:8px; color: #666;">JEFE DEL DEPTO. DE RECURSOS MATERIALES</div>
        @endif
      </div>
    </td>
    <td class="text-center" rowspan="3">
      <div style="min-height: 100px;">
        <div style="margin-bottom:4px;font-size:9px;">Entregó</div>
        <div style="height:60px;"></div>
        <div style="border-top:1px solid #000; width:90%; margin:0 auto 2px auto;"></div>
        <div style="font-size:8px;">Nombre, Apellido y Firma</div>
      </div>
    </td>
    <td class="text-center" rowspan="3">
      <div style="min-height: 100px;">
        <div style="margin-bottom:4px;font-size:9px;">Recibió</div>
        <div style="height:60px;"></div>
        <div style="border-top:1px solid #000; width:90%; margin:0 auto 2px auto;"></div>
        <div style="font-size:8px;">Nombre, Apellido y Firma</div>
      </div>
    </td>
    
    <td>
      <strong>IVA</strong><br>
      ${{ number_format((float)($order->iva ?? 0), 2) }}
    </td>
  </tr>
  <tr>
    <td>
      <strong>ISR</strong><br>
      ${{ number_format((float)($order->isr_retention ?? 0), 2) }}
    </td>
  </tr>
  <tr>
    <td>
      <strong>TOTAL</strong><br>
      ${{ number_format((float)($order->total ?? 0), 2) }}
    </td>
  </tr>
  <tr>
    <td colspan="4"><strong>IMPORTE CON LETRA:</strong> {{ $importe_letra ?? ($order->importe_letra ?? '') }}</td>
  </tr>
</table>

</body>
</html>
