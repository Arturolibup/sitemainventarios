<?php

namespace App\Http\Controllers\OP;


use Throwable;

use Carbon\Carbon;
use App\Models\User;

use App\Mail\OrderCreated;
use App\Models\OP\OrderLog;
use App\Mail\OrderValidated;
use App\Utils\Numbertowords;
use Illuminate\Http\Request;
use App\Models\OP\Notification;
use App\Models\OP\OrderProduct;
use App\Models\OP\OrderRequest;
use App\Models\Product\Product;
use App\Services\SocketService;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use App\Http\Controllers\Controller;
use Illuminate\Support\Facades\Mail;
use App\Models\Configuration\Provider;
use Illuminate\Support\Facades\Storage;
use Spatie\Permission\Models\Permission;
use Illuminate\Support\Facades\Validator;
use Barryvdh\DomPDF\Facade\Pdf; // **NUEVO**: Importar la clase PDF
use App\Mail\SuficienciaCreated; // **NUEVO**: Correo para suficiencia presupuestal


class OrderController extends Controller
{

    public function __construct()
    {
        // LISTAR y VER
    $this->middleware('permission:orders.list')->only(['index']);
    $this->middleware('permission:orders.view')->only(['getOrder', 'getPdf', 'sendPdfToProvider']);

    // CREAR / EDITAR / ACTUALIZAR
    $this->middleware('permission:orders.create_sf|orders.update|orders.add_order_number')
         ->only(['createSuficiencia', 'update', 'sendToArea2']);

    // VALIDACIONES POR ÁREA
    $this->middleware('permission:orders.assign_partidas|orders.update')
         ->only(['validateSuficiencia', 'validateArea2']);
    $this->middleware('permission:orders.validate|orders.add_order_number')
         ->only(['validateOrder']);
    $this->middleware('permission:orders.receive')->only(['receiveProducts']);

    // BORRAR
    $this->middleware('permission:orders.delete|orders.update')->only(['delete']);

    // UTILIDADES
    $this->middleware('permission:orders.create_sf|orders.update')->only(['checkUnique']);
       
        /*/ LISTAR y VER
        $this->middleware('permission:orders.list')->only(['index']);
        $this->middleware('permission:orders.view')->only(['getOrder', 'getPdf']);

        // CREAR / EDITAR / ACTUALIZAR
        $this->middleware('permission:orders.create_sf')->only(['createSuficiencia']);
        $this->middleware('permission:orders.update')->only(['update', 'sendToArea2']);

        // VALIDACIONES POR ÁREA
        $this->middleware('permission:orders.assign_partidas')->only(['validateSuficiencia','validateArea2']);
        $this->middleware('permission:orders.validate')->only(['validateOrder']);
        $this->middleware('permission:orders.receive')->only(['receiveProducts']);

        // Borrar
        $this->middleware('permission:orders.delete')->only(['delete']);

        // Utilidades
        $this->middleware('permission:orders.create_sf|orders.update')->only(['checkUnique']);

        // PDF / notificaciones por correo (ver la orden alcanza)
        $this->middleware('permission:orders.view')->only(['sendPdfToProvider']);  */
    }

    public function index(Request $request): JsonResponse
    {
        $user = auth('api')->user();
        if (!$user) {
            return response()->json(['message' => 'Usuario no autenticado'], 401);
        }

        // consulta con relaciones
        $query = OrderRequest::with([
            'createdBy',
            'provider',
            'products',
            'requesterArea',
            'requesterSubarea',
            'invoices',
            'notifications',
            'orderValidations',
            'orderLogs'
        ])
        ->withCount('invoices')
        ->whereNull('deleted_at');

        // 🔹 1) Bypass: Admin o Super-Admin pueden ver todo
        if ($user->hasRole('Admin') || $user->hasRole('Super-Admin')) {
            // no aplicamos restricciones adicionales
        }
        // 🔹 2) Área 1 (creadores)
        elseif ($user->hasPermissionTo('orders.create_sf')) {
            $query->where(function ($q) use ($user) {
                $q->where('created_by', $user->id)
                ->orWhereIn('status', ['pending_sf_validation', 'validate_sf', 'pending_warehouse', 'completed', 'partially_received']);
            });
        }
        // 🔹 3) Área 2 (contabilidad)
        elseif ($user->hasPermissionTo('orders.assign_partidas')) {
            $query->whereIn('status', ['pending_sf_validation']);
        }
        // 🔹 4) Área 3 (almacén)
        elseif ($user->hasPermissionTo('orders.receive')) {
            $query->whereIn('status', ['pending_warehouse', 'partially_received', 'completed']);
        }
        // 🔹 5) Fallback: cualquier usuario con orders.list puede ver todas
        elseif ($user->hasPermissionTo('orders.list')) {
            // no aplicamos restricciones, solo listan
        }
        else {
            return response()->json(['message' => 'No tienes permisos para ver órdenes'], 403);
        }

        // parámetros de paginación y filtros
        $page = $request->query('page', 1);
        $perPage = $request->query('per_page', 10);
        $queryStr = $request->query('query', '');
        $status = $request->query('status', '');
        $sort = $request->query('sort', 'created_at');
        $direction = $request->query('direction', 'desc');

        if ($queryStr) {
            $query->where(function ($q) use ($queryStr) {
                $q->where('order_number', 'like', "%$queryStr%")
                ->orWhere('foliosf', 'like', "%$queryStr%")
                ->orWhere('process', 'like', "%$queryStr%")
                ->orWhereHas('provider', function ($q) use ($queryStr) {
                    $q->where('full_name', 'like', "%$queryStr%");
                });
            });
        }

        if ($status) {
            $statuses = explode(',', $status);
            $query->whereIn('status', $statuses);
        }

        $orders = $query->orderBy($sort, $direction)->paginate($perPage, ['*'], 'page', $page);

        return response()->json([
            'data' => $orders->items(),
            'meta' => [
                'total' => $orders->total(),
                'per_page' => $orders->perPage(),
                'current_page' => $orders->currentPage()
            ]
        ], 200);
    }

    

/**
 * Determina el área del usuario basado en sus permisos
 */
    private function getUserArea(User $user): string
    {
        if ($user->hasPermissionTo('orders.create_sf')) {
            return 'area1';
        } elseif ($user->hasPermissionTo('orders.assign_partidas')) {
            return 'area2'; 
        } elseif ($user->hasPermissionTo('orders.receive')) {
            return 'area3';
        }
        return 'system';
    }
    
    public function createSuficiencia(Request $request): JsonResponse
    {
        $user = auth('api')->user();
        if (!$user || !$user->hasPermissionTo('orders.create_sf')) {
            return response()->json(['message' => 'Acceso no autorizado'], 403);
        }

        $validator = Validator::make($request->all(), [
            //validamos todos los campos necesarios de order_request
            'order_number' => 'nullable|string|max:255',
            'date' => 'required|date',
            'date_limited' => 'required|date|after_or_equal:date',
            'format_type' => 'required|in:FERRETERIA,REFACCIONES,PRODUCTOS',
            'process' => 'required|string',
            'provider_id' => 'required|exists:providers,id',
            'requester_area_id' => 'required|exists:areas,id',
            'requester_subarea_id' => 'nullable|exists:subareas,id',
            'ur' => 'required|string|max:50',
            'delivery_place' => 'required|string|max:255',
            'concept_total' => 'required|numeric|min:0',
            'iva' => 'required|numeric|min:0',
            'isr_retention' => 'required|numeric|min:0',
            'total' => 'required|numeric|min:0',
            'no_beneficiarios' => 'nullable|integer',
            'oficio_origen' => 'nullable|string|max:255',
            'foliosf' => 'required|string|max:255|unique:order_requests,foliosf', // **NUEVO**: foliosf obligatorio
            'subsidio_estatal' => 'boolean',
            'ingresos_propios' => 'boolean',
            'federal' => 'boolean',
            'mixto' => 'boolean',
            'general_observations' => 'nullable|string|',
            'status' => 'required|in:pending_sf_validation', // Validar solo el estado inicial
            //aqui validamos todos los campos de order_products
            'products' => 'required|array|min:1',
            'products.*.progresivo' => 'required|string|max:25',
            'products.*.ur_progressive' => 'required|string|max:50',
            'products.*.grupo' => 'nullable|string|max:20',
            'products.*.subgrupo' => 'nullable|string|max:20',
            'products.*.oficio' => 'nullable|string|max:20',
            'products.*.quantity' => 'required|integer|min:1',
            'products.*.unit_id' => 'required|exists:units,id',
            'products.*.description' => 'required|string',
            'products.*.brand' => 'nullable|string|max:100',
            'products.*.marca_id' => 'nullable|integer|exists:marcas,id',
            'products.*.tipo_id' => 'nullable|integer|exists:tipos,id',
            'products.*.placa' => 'nullable|string|max:25',
            'products.*.modelo' => 'nullable|string|max:10',
            'products.*.cilindro' => 'nullable|string|max:20',
            'products.*.unit_price' => 'required|numeric|min:0',
            'products.*.partida' => 'nullable|string|max:50',
            'products.*.received_quantity' => 'nullable|integer|min:0',
            'products.*.is_delivered' => 'boolean',
            'products.*.observations' => 'nullable|string|',
            'products.*.product_id' => 'required|exists:products,id',
            'products.*.vehicle_id' => 'nullable|exists:vehiculos,id',
        ]);

        if ($validator->fails()) {
            return response()->json(['message' => 'Validación fallida', 'errors' => $validator->errors()], 400);
        }

        DB::beginTransaction();
        try {
            $order = new OrderRequest();
            $order->fill($request->only([
                'order_number', 'date', 'date_limited', 'format_type', 'process', 'provider_id',
                'requester_area_id', 'requester_subarea_id', 'ur', 'delivery_place',
                'concept_total', 'iva', 'isr_retention', 'total', 'pdf_path', 'suficiencia_pdf_path', 'is_pdf_sent',
                 'no_beneficiarios', 'oficio_origen', 'foliosf', 'subsidio_estatal', 'ingresos_propios', 'federal', 'mixto',
                 'general_observations', 'validated_area2_at', 'validated_area1_at', 'received_at',
            ]));
            $order->order_number = null;
            $order->status = 'pending_sf_validation'; // **NUEVO**: Estado inicial para suficiencia
            $order->created_by = $user->id;
            $order->updated_by = $user->id;
            $order->save();

            $productsCreated = [];
            foreach ($request->products as $productData) {
                $product = new OrderProduct([
                    'order_request_id' => $order->id,
                    'progresivo' => $productData['progresivo'],
                    'ur_progressive' => $productData['ur_progressive'],
                    'quantity' => $productData['quantity'],
                    'unit_id' => $productData['unit_id'],
                    'description' => $productData['description'],
                    'brand' => $productData['brand'] ?? null,
                    'marca_id' => $productData['marca_id'] ?? null,
                    'tipo_id' => $productData['tipo_id'] ?? null,
                    'placa' => $productData['placa'] ?? null,
                    'modelo' => $productData['modelo'] ?? null,
                    'oficio' => $productData['oficio'] ?? null,
                    'grupo' => $productData['grupo'] ?? null,
                    'subgrupo' => $productData['subgrupo'] ?? null,
                    'cilindro' => $productData['cilindro'] ?? null,
                    'unit_price' => round($productData['unit_price'], 2),
                    'partida' => $productData['partida'] ?? null,
                    'amount' => round($productData['unit_price'] * $productData['quantity'], 2),
                    'received_quantity' => $productData ['received_quantity'] ?? 0,
                    'is_delivered' => $productData['is_delivered'] ?? false,
                    'product_id'       => $productData['product_id'],              // ✅ NUEVO
                    'vehicle_id'       => $productData['vehicle_id'] ?? null,
                ]);
                $product->save();
                $productsCreated[] = $product;
            }

            $log = new OrderLog([
                'order_request_id' => $order->id,
                'user_id' => $user->id,
                'action' => 'created_suficiencia',
                'details' => 'Suficiencia presupuestal creada con folio ' . $order->foliosf . ' por ' . $user->name . ' ' . ($user->surname ?? '')
            ]);
            $log->save();

            // 🔹 Obtener usuarios de Área 2 con permiso assign_partidas
            $permission = Permission::where('name', 'orders.assign_partidas')->first();
            $area2Users = $permission ? $permission->users()->get() : collect();

            foreach ($area2Users as $area2User) {
                Notification::create([
                    'user_id' => $area2User->id,
                    'order_request_id' => $order->id,
                    'message' => 'Nueva suficiencia presupuestal con folio ' . $order->foliosf . ' para revisar.',
                    'created_at' => Carbon::now(),
                    'type' => 'info',
                ]);
            }

            /*
            // Enviar correo al usuario creador
            try {
                if ($order->pdf_path) {
                    // Ya existe orden final -> enviamos orden
                    Mail::to($order->provider->email)->send(new order_created($order));
                } else {
                    // Solo suficiencia -> enviamos suficiencia
                    Mail::to($order->provider->email)->send(new suficiencia_created($order));
                }
            } catch (Throwable $e) {
                Log::error('Error al enviar correo: '.$e->getMessage(), [
                    'trace' => $e->getTraceAsString(),
                ]);
            }
            */

            DB::commit();
            $order->load('createdBy', 'provider', 'requesterArea', 'requesterSubarea', 'products', 'products.marca', 'products.tipo');

            // ← AÑADE ESTO PARA NOTIFICACIÓN EN TIEMPO REAL
            SocketService::sendNotification([
                'title' => 'Nueva Suficiencia Presupuestal Creada',
                'message' => 'Suficiencia con Folio:' . $order->foliosf . ' creada por ' . $user->name,
                'type' => 'info',
                'module' => 'ordenes',
                'order_id' => $order->id
            ]);
            
            return response()->json(['message' => 'Suficiencia presupuestal creada exitosamente', 'data' => $order], 201);
        } catch (Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Error al crear la suficiencia', 'errors' => $e->getMessage()], 400);
        }
    }

    /**
     * Enviar orden a Área 2 para revisión (POST /orders/{id}/send-to-area2)
     * **NUEVO**: Endpoint para enviar la orden a Área 2 (estado pending_area2)
     */
    public function sendToArea2(Request $request, $id): JsonResponse
    {
        $user = auth('api')->user();
        if (!$user || !$user->hasPermissionTo('orders.create_sf')) {
            return response()->json(['message' => 'Acceso no autorizado'], 403);
        }

        $order = OrderRequest::findOrFail($id);
        if ($order->status !== 'pending_sf_validation') {
            return response()->json(['message' => 'La orden no está en estado para enviar a Área 2'], 403);
        }

        $validator = Validator::make($request->all(), [
            'foliosf' => 'required|string|max:255|unique:order_requests,foliosf,' . $id // **NUEVO**: Validar foliosf como obligatorio y único
        ]);

        if ($validator->fails()) {
            return response()->json(['message' => 'Validación fallida', 'errors' => $validator->errors()], 400);
        }

        DB::beginTransaction();
        try {
            $order->update([
                'foliosf' => $request->foliosf,
                'status' => 'pending_sf_validation',
                'updated_by' => $user->id
            ]);

            $log = new OrderLog([
                'order_request_id' => $order->id,
                'user_id' => $user->id,
                'action' => 'sent_to_contabilidad',
                'details' => 'Orden enviada a Contabilidad con folio ' . $request->foliosf . ' por ' . $user->name . ' ' . ($user->surname ?? '')
            ]);
            $log->save();

            $permission = Permission::where('name', 'orders.assign_partidas')->first();
            $area2Users = $permission ? $permission->users()->get() : collect();

            //$area2Users = User::permissions('orders.assign_partidas')->get();

            foreach ($area2Users as $area2User) {
                Notification::create([
                    'user_id' => $area2User->id,
                    'order_request_id' => $order->id,
                    'message' => 'Orden #' . $order->order_number . ' enviada a contabilidad con folio ' . $order->foliosf . ' para revisión.',
                    'created_at' => Carbon::now(),
                    'type' => 'info',
                ]);
            }

            DB::commit();
            $order->load('createdBy', 'provider', 'requesterArea', 'requesterSubarea', 'products', 'products.marca', 'products.tipo');
            
            SocketService::sendNotification([
                'title' => 'Nueva Suficiencia Presupuestal Creada',
                'message' => 'Suficiencia con Folio: ' . $order->foliosf . ' creada por ' . $user->name,
                'type' => 'success',
                'module' => 'ordenes',
                'order_id' => $order->id]);

            return response()->json(['message' => 'Orden enviada a contabilidad exitosamente', 'data' => $order], 200);
        } catch (Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Error al enviar la orden a contabilidad', 'errors' => $e->getMessage()], 400);
        }
    }

    /**
     * Validar suficiencia presupuestal (Área 2, modo validate_sf)
     * **NUEVO**: Endpoint para validar la suficiencia y generar el PDF
     */
    
    public function validateSuficiencia(Request $request, $id): JsonResponse
    {
        $user = auth('api')->user();
        if (!$user || !$user->hasPermissionTo('orders.assign_partidas')) {
            return response()->json(['message' => 'Acceso no autorizado'], 403);
        }

        $order = OrderRequest::findOrFail($id);
        if ($order->status !== 'pending_sf_validation') {
            return response()->json(['message' => 'La orden no está pendiente de validación de suficiencia'], 403);
        }

        $validator = Validator::make($request->all(), [
            'subsidio_estatal' => 'boolean',
            'ingresos_propios' => 'boolean',
            'federal' => 'boolean',
            'mixto' => 'boolean',
            'products' => 'required|array',
            'products.*.id' => 'required|exists:order_products,id',
            'products.*.partida' => 'required|string|max:50', 
            'products.*.observations' => 'nullable|string|max:250'
        ]);

        if ($validator->fails()) {
            return response()->json(['message' => 'Validación fallida', 'errors' => $validator->errors()], 400);
        }

        // 🚨 Nueva validación: debe elegirse al menos un tipo de financiamiento
        if (
            !$request->boolean('subsidio_estatal') &&
            !$request->boolean('ingresos_propios') &&
            !$request->boolean('federal') &&
            !$request->boolean('mixto')
        ) {
            return response()->json([
                'message' => 'Debes seleccionar al menos un tipo de financiamiento antes de validar la suficiencia.'
            ], 400);
        }

        DB::beginTransaction();
        try {
            $order->update([
                'subsidio_estatal' => $request->subsidio_estatal,
                'ingresos_propios' => $request->ingresos_propios,
                'federal' => $request->federal,
                'mixto' => $request->mixto,
                'status' => 'validate_sf',
                'updated_by' => $user->id,
                'validated_area2_at' => Carbon::now()
            ]);

            foreach ($request->products as $productData) {
                $product = OrderProduct::findOrFail($productData['id']);
                $product->update([
                    'partida' => $productData['partida'],
                    'observations' => $productData['observations'] ?? null
                ]);
            }

            $importe_letra = Numbertowords::toCurrencyEs($order->total ?? 0);
            // Generar y guardar el PDF de suficiencia

            // ✅ Generar y guardar el PDF de suficiencia
            $pdf = Pdf::loadView('pdf.suficiencia_created', [
                'order'         => $order,
                'importe_letra' => $importe_letra,
                'format_type'   => $order->format_type,
            ]);

            // 🔹 Si ya existe un PDF previo, elimínalo
            if ($order->suficiencia_pdf_path && Storage::disk('public')->exists($order->suficiencia_pdf_path)) {
                Storage::disk('public')->delete($order->suficiencia_pdf_path);
            }

            // 🔹 Nombre fijo para sobrescribir siempre el mismo archivo
            $pdfPath = "suficiencias/suficiencia_{$order->id}.pdf";

            // 🔹 Guardar PDF correctamente (sin duplicar “public/”)
            Storage::disk('public')->put($pdfPath, $pdf->output());

            // 🔹 Guardar ruta en base de datos
            $order->suficiencia_pdf_path = $pdfPath;
            $order->save();
            
          

            $log = new OrderLog([
                'order_request_id' => $order->id,
                'user_id' => $user->id,
                'action' => 'validated_suficiencia',
                'details' => 'Suficiencia presupuestal Validada ' . $order->foliosf . ' por ' . $user->name . ' ' . ($user->surname ?? '')
            ]);
            $log->save();

            Notification::create([
                'user_id' => $order->created_by,
                'order_request_id' => $order->id,
                'message' => 'La suficiencia presupuestal con ' . $order->foliosf . ' ha sido validada.',
                'created_at' => Carbon::now(),
                'type' => 'info',
            ]);

            DB::commit();
            $order->load('createdBy', 'provider', 'requesterArea', 'requesterSubarea', 'products', 'products.marca', 'products.tipo');

            // ← AÑADE ESTO PARA NOTIFICACIÓN EN TIEMPO REAL
            SocketService::sendNotification([
                'title' => 'Suficiencia Presupuestal Validada',
                'message' => 'La Suf.Pres. ' . $order->foliosf . ' fué validada por ' . $user->name,
                'type' => 'success',
                'module' => 'ordenes',
                'order_id' => $order->id
            ]);
            return response()->json(['message' => 'Suficiencia validada exitosamente', 
            'data' => $order, 
            'pdf_path' => $pdfPath], 200);
        } catch (Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Error al validar la suficiencia', 'errors' => $e->getMessage()], 400);
        }
    }

    /**
     * Editar una orden (Área 1)
     * **MODIFICADO**: Añadir soporte para foliosf
     */
    public function update(Request $request, $id): JsonResponse
    {
        $user = auth('api')->user();
        if (!$user || !$user->hasPermissionTo('orders.update')) {
            return response()->json(['message' => 'Acceso no autorizado'], 403);
        }

        $order = OrderRequest::findOrFail($id);
        if ($order->status !== 'pending_sf_validation') {
            return response()->json(['message' => 'La orden no está en estado editable'], 403);
        }

        $validator = Validator::make($request->all(), [
            //validamos todos los campos necesarios de order_request
            'order_number' => 'nullable|string|max:255',
            'date' => 'required|date',
            'date_limited' => 'required|date|after_or_equal:date',
            'format_type' => 'required|in:FERRETERIA,REFACCIONES,PRODUCTOS',
            'process' => 'required|string',
            'provider_id' => 'required|exists:providers,id',
            'requester_area_id' => 'required|exists:areas,id',
            'requester_subarea_id' => 'nullable|exists:subareas,id',
            'ur' => 'required|string|max:50',
            'delivery_place' => 'required|string|max:255',
            'concept_total' => 'required|numeric|min:0',
            'iva' => 'required|numeric|min:0',
            'isr_retention' => 'required|numeric|min:0',
            'total' => 'required|numeric|min:0',
            'no_beneficiarios' => 'nullable|integer',
            'oficio_origen' => 'nullable|string|max:255',
            'foliosf' => 'nullable|string|max:255|unique:order_requests,foliosf', // **NUEVO**: foliosf obligatorio
            'subsidio_estatal' => 'boolean',
            'ingresos_propios' => 'boolean',
            'federal' => 'boolean',
            'mixto' => 'boolean',
            'general_observations' => 'nullable|string|',
            'status' => 'required|in:pending_sf_validation', // Validar solo el estado inicial
            //aqui validamos todos los campos de order_products
            'products' => 'required|array|min:1',
            'products.*.progresivo' => 'required|string|max:25',
            'products.*.ur_progressive' => 'required|string|max:50',
            'products.*.grupo' => 'nullable|string|max:20',
            'products.*.subgrupo' => 'nullable|string|max:20',
            'products.*.oficio' => 'nullable|string|max:20',
            'products.*.quantity' => 'required|integer|min:1',
            'products.*.unit_id' => 'required|exists:units,id',
            'products.*.description' => 'required|string',
            'products.*.brand' => 'nullable|string|max:100',
            'products.*.marca_id' => 'nullable|integer|exists:marcas,id',
            'products.*.tipo_id' => 'nullable|integer|exists:tipos,id',
            'products.*.placa' => 'nullable|string|max:25',
            'products.*.modelo' => 'nullable|string|max:10',
            'products.*.cilindro' => 'nullable|string|max:20',
            'products.*.unit_price' => 'required|numeric|min:0',
            'products.*.partida' => 'nullable|string|max:50',
            'products.*.received_quantity' => 'nullable|integer|min:0',
            'products.*.is_delivered' => 'boolean',
            'products.*.observations' => 'nullable|string|',
            'products' => 'required|array|min:1',
            'products.*.product_id' => 'required|exists:products,id',
            'products.*.vehicle_id' => 'nullable|exists:vehiculos,id',
        ]);

        if ($validator->fails()) {
            return response()->json(['message' => 'Actualización fallida', 'errors' => $validator->errors()], 400);
        }

        DB::beginTransaction();
        try {
            // 🔹 Recalcular totales desde los productos
            $conceptTotal = collect($request->products)
                ->sum(fn($p) => (float)$p['unit_price'] * (int)$p['quantity']);
            $iva = $request->iva ?? 0;
            $isr = $request->isr_retention ?? 0;
            $total = $conceptTotal + $iva - $isr;

            $order->update([
                'order_number' => $request->order_number,
                'date' => $request->date,
                'date_limited' => $request->date_limited,
                'format_type' => $request->format_type,
                'process' => $request->process,
                'provider_id' => $request->provider_id,
                'requester_area_id' => $request->requester_area_id,
                'requester_subarea_id' => $request->requester_subarea_id,
                'no_beneficiarios' => $request->no_beneficiarios,
                'oficio_origen' => $request->oficio_origen,
                'foliosf' => $request->foliosf,
                'ur' => $request->ur,
                'delivery_place' => $request->delivery_place,
                'concept_total' => round($conceptTotal, 2),
                'iva' => round($iva, 2),
                'isr_retention' => round($isr, 2),
                'total' => round($total, 2),
                'updated_by' => $user->id,
            ]);

            // 🔹 Actualizar o crear productos
            $existingProductIds = [];
            foreach ($request->products as $productData) {
                if (isset($productData['id'])) {
                    $product = OrderProduct::findOrFail($productData['id']);
                    $product->update([
                        'progresivo' => $productData['progresivo'],
                        'ur_progressive' => $productData['ur_progressive'],
                        'quantity' => $productData['quantity'],
                        'unit_id' => $productData['unit_id'],
                        'description' => $productData['description'],
                        'brand' => $productData['brand'] ?? null,
                        'marca_id' => $productData['marca_id'] ?? null,
                        'tipo_id' => $productData['tipo_id'] ?? null,
                        'placa' => $productData['placa'] ?? null,
                        'modelo' => $productData['modelo'] ?? null,
                        'oficio' => $productData['oficio'] ?? null,
                        'grupo' => $productData['grupo'] ?? null,
                        'subgrupo' => $productData['subgrupo'] ?? null,
                        'cilindro' => $productData['cilindro'] ?? null,
                        'unit_price' => round($productData['unit_price'], 2),
                        'partida' => $productData['partida'],
                        'amount' => round($productData['unit_price'] * $productData['quantity'], 2),
                        'product_id'     => $productData['product_id'],            // ✅ NUEVO
                        'vehicle_id'     => $productData['vehicle_id'] ?? null,
                    ]);
                    $existingProductIds[] = $productData['id'];
                } else {
                    $newProduct = OrderProduct::create([
                        'order_request_id' => $order->id,
                        'progresivo' => $productData['progresivo'],
                        'ur_progressive' => $productData['ur_progressive'],
                        'quantity' => $productData['quantity'],
                        'unit_id' => $productData['unit_id'],
                        'description' => $productData['description'],
                        'brand' => $productData['brand'] ?? null,
                        'marca_id' => $productData['marca_id'] ?? null,
                        'tipo_id' => $productData['tipo_id'] ?? null,
                        'placa' => $productData['placa'] ?? null,
                        'modelo' => $productData['modelo'] ?? null,
                        'oficio' => $productData['oficio'] ?? null,
                        'grupo' => $productData['grupo'] ?? null,
                        'subgrupo' => $productData['subgrupo'] ?? null,
                        'cilindro' => $productData['cilindro'] ?? null,
                        'unit_price' => round($productData['unit_price'], 2),
                        'partida' => $productData['partida'],
                        'amount' => round($productData['unit_price'] * $productData['quantity'], 2),
                        'received_quantity' => 0,
                        'is_delivered' => false,
                        'product_id'       => $productData['product_id'],           // ✅ NUEVO
                        'vehicle_id'       => $productData['vehicle_id'] ?? null,   // ✅ NUEVO
                    ]);
                    $existingProductIds[] = $newProduct->id;
                }
            }

            // 🔹 Eliminar productos no incluidos
            OrderProduct::where('order_request_id', $order->id)
                ->whereNotIn('id', $existingProductIds)
                ->delete();

            // 🔹 Registrar log y notificación
            OrderLog::create([
                'order_request_id' => $order->id,
                'user_id' => $user->id,
                'action' => 'updated',
                'details' => 'Orden actualizada por ' . $user->name,
            ]);

            Notification::create([
                'user_id' => $order->created_by,
                'order_request_id' => $order->id,
                'message' => 'La orden #' . $order->order_number . ' ha sido actualizada.',
                'created_at' => Carbon::now(),
                'type' => 'info',
            ]);

            // 🔹 Generar y guardar el PDF ANTES del return
            $importe_letra = Numbertowords::toCurrencyEs($order->total ?? 0);
            $pdf = Pdf::loadView('pdf.suficiencia_created', [
                'order'         => $order,
                'importe_letra' => $importe_letra,
                'format_type'   => $order->format_type,
            ]);

            $pdfPath = "suficiencias/suficiencia_{$order->id}.pdf";
            Storage::disk('public')->put($pdfPath, $pdf->output());
            $order->suficiencia_pdf_path = $pdfPath;
            $order->save();

            // 🔹 Cargar relaciones y notificar en tiempo real
            $order->load('createdBy', 'provider', 'requesterArea', 'requesterSubarea', 'products', 'products.marca', 'products.tipo');

            SocketService::sendNotification([
                'title' => 'S.F. Actualizada',
                'message' => 'Suficiencia ' . $order->foliosf . ' actualizada por ' . $user->name,
                'type' => 'warning',
                'module' => 'ordenes',
                'order_id' => $order->id,
                'type' => 'info',
            ]);

            DB::commit();

            return response()->json([
                'message' => 'Suficiencia actualizada correctamente',
                'data' => $order,
                'pdf_path' => $pdfPath,
            ], 200);

        } catch (Exception $e) {
            DB::rollBack();
            return response()->json([
                'message' => 'Error al actualizar la Suficiencia',
                'errors' => $e->getMessage(),
            ], 400);
        }
    }

    // Nuevo método para validar unicidad de foliosf y order_number
    public function checkUnique(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'field' => 'required|in:foliosf,order_number',
            'value' => 'required|string|max:255'
        ]);

        if ($validator->fails()) {
            return response()->json(['message' => 'Validación fallida', 'errors' => $validator->errors()], 400);
        }

        $field = $request->input('field');
        $value = $request->input('value');

        $exists = OrderRequest::where($field, $value)->exists();

        return response()->json(['isUnique' => !$exists], 200);
    }
    /**
     * Obtener una orden específica
     */
    public function getOrder($id): JsonResponse
    {
        $user = auth('api')->user();
        if (!$user) {
            return response()->json(['message' => 'Usuario no autenticado'], 401);
        }

        $order = OrderRequest::with([
            'createdBy',
            'provider',
            'products',
            'requesterArea',
            'requesterSubarea',
            'requesterSubarea.area',
            'products.marca',
            'products.tipo',
            'products.unit',
            
        ])->findOrFail($id);

        // 🔹 Agregar nombres planos para Angular
        // Normalizar para Angular
        $order->requester_area_name = $order->requesterArea->name ?? ($order->requesterSubarea->area->name ?? '');
        $order->requester_subarea_name = $order->requesterSubarea->name ?? '';
        $order->ur = $order->ur ?? ($order->requesterSubarea->area->urs ?? '');
        $order->unit_name = $order->unit_id ?? ($order->unit->name?? '');


        // Planos por producto (evita tener que navegar relaciones en Angular)
        $order->products->transform(function ($p) {
            $p->unit_name  = $p->unit->name  ?? '';
            $p->marca_nombre = $p->marca->nombre ?? '';
            $p->tipo_nombre  = $p->tipo->nombre ?? '';
            return $p;
        });
            
        return response()->json($order, 200);
    }

    /**
     * Validar orden (Área 1)
     * **MODIFICADO**: Añadir soporte para foliosf
     */
    public function validateOrder(Request $request, $id): JsonResponse
    {
        $user = auth('api')->user();
        if (!$user || !$user->hasPermissionTo('orders.validate')) {
            return response()->json(['message' => 'Acceso no autorizado'], 403);
        }

        $order = OrderRequest::findOrFail($id);
        if ($order->status !== 'validate_sf') {
            return response()->json(['message' => 'La orden no está pendiente de validación'], 403);
        }

        $validator = Validator::make($request->all(), [
            'order_number' => 'required|string|unique:order_requests,order_number,' . $id,
            'date' => 'required|date',
            'date_limited' => 'required|date|after_or_equal:date',
            'format_type' => 'required|in:FERRETERIA,REFACCIONES,PRODUCTOS',
            'process' => 'required|string',
            'provider_id' => 'required|exists:providers,id',
            'oficio' => 'nullable|string|max:255',
            'no_beneficiarios' => 'nullable|integer',
            'oficio_origen' => 'nullable|string|max:255',
            'foliosf' => 'nullable|string|max:255|unique:order_requests,foliosf,' . $id,
            'requester_area_id' => 'required|exists:areas,id',
            'requester_subarea_id' => 'nullable|exists:subareas,id',
            'ur' => 'required|string|max:50',
            'delivery_place' => 'required|string|max:255',
            'concept_total' => 'required|numeric|min:0',
            'iva' => 'required|numeric|min:0',
            'isr_retention' => 'required|numeric|min:0',
            'total' => 'required|numeric|min:0'
        ]);

        if ($validator->fails()) {
            return response()->json(['message' => 'Validación fallida', 'errors' => $validator->errors()], 400);
        }

        DB::beginTransaction();
        try {
            // ✅ 1. Actualizamos datos básicos
            $order->update([
                'order_number' => $request->order_number,
                'date' => $request->date,
                'date_limited' => $request->date_limited,
                'format_type' => $request->format_type,
                'process' => $request->process,
                'provider_id' => $request->provider_id,
                'oficio' => $request->oficio,
                'no_beneficiarios' => $request->no_beneficiarios,
                'oficio_origen' => $request->oficio_origen,
                'foliosf' => $request->foliosf,
                'requester_area_id' => $request->requester_area_id,
                'requester_subarea_id' => $request->requester_subarea_id,
                'ur' => $request->ur,
                'delivery_place' => $request->delivery_place,
                'concept_total' => round($request->concept_total, 2),
                'iva' => round($request->iva, 2),
                'isr_retention' => round($request->isr_retention, 2),
                'total' => round($request->total, 2),
                'status' => 'pending_warehouse',
                'updated_by' => $user->id,
                'validated_area1_at' => Carbon::now(),
            ]);

            $importe_letra = Numbertowords::toCurrencyEs($order->total ?? 0);

            // ✅ Generar y guardar el PDF de orden
                $pdf = Pdf::loadView('pdf.order_created', [
                    'order'         => $order,
                    'importe_letra' => $importe_letra,
                    'format_type'   => $order->format_type,
                ])->setPaper('letter', 'landscape');

                // 🔹 Si ya existe un PDF previo, elimínalo (solo si usas mismo nombre)
                if ($order->pdf_path && Storage::disk('public')->exists($order->pdf_path)) {
                    Storage::disk('public')->delete($order->pdf_path);
                }

                // 🔹 Usa nombre fijo para sobrescribir (si lo deseas)
                $pdfPath = "ordenes/orden_{$order->id}.pdf";

                // 🔹 Guardar correctamente sin duplicar “public/”
                Storage::disk('public')->put($pdfPath, $pdf->output());

                // 🔹 Guardar ruta
                $order->pdf_path = $pdfPath;
                $order->save();

            

            // ✅ 5. Log y notificación
            $log = new OrderLog([
                'order_request_id' => $order->id,
                'user_id' => $user->id,
                'action' => 'validated_area1',
                'details' => 'Orden validada por R.M por ' . $user->name . ' ' . ($user->surname ?? '')
            ]);
            $log->save();

            Notification::create([
                'user_id' => $order->created_by,
                'order_request_id' => $order->id,
                'message' => 'La orden # ' . $order->order_number . ' ha sido validada por R.M.',
                'created_at' => Carbon::now(),
                'type' => 'info',
            ]);

            DB::commit();

            // ✅ 6. Notificación tiempo real
            SocketService::sendNotification([
                'title' => 'Orden Validada',
                'message' => 'Orden:  ' . $order->order_number . '  validada por R.M',
                'type' => 'success',
                'module' => 'ordenes',
                'order_id' => $order->id,
            ]);

            // ✅ 7. Devolvemos PDF listo para abrir
            return response()->json([
                'message'   => 'Orden validada exitosamente',
                'data'      => $order,
                'pdf_path'  => $pdfPath,
                'pdf_url'   => url('storage/' . $pdfPath),
                'importe_letra' => $importe_letra,
            ], 200);

        } catch (Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Error al validar la orden', 'errors' => $e->getMessage()], 400);
        }
    }



    /**
     * Recibir productos (Área 3)
     */
    public function receiveProducts(Request $request, $id): JsonResponse
    {
        $user = auth('api')->user();
        if (!$user || !$user->hasPermissionTo('orders.receive')) {
            return response()->json(['message' => 'Acceso no autorizado'], 403);
        }

        $order = OrderRequest::findOrFail($id);
        if (!in_array($order->status, ['pending_warehouse', 'partially_received'])) {
            return response()->json(['message' => 'La orden no está en estado para recepción'], 403);
        }

        $validator = Validator::make($request->all(), [
            'general_observations' => 'nullable|string',
            'products' => 'required|array',
            'products.*.id' => 'required|exists:order_products,id',
            'products.*.received_quantity' => 'required|integer|min:0',
            'products.*.is_delivered' => 'required|boolean'
        ]);

        if ($validator->fails()) {
            return response()->json(['message' => 'Validación fallida', 'errors' => $validator->errors()], 400);
        }

        DB::beginTransaction();
        try {
            $allDelivered = true;
            foreach ($request->products as $productData) {
                $product = OrderProduct::findOrFail($productData['id']);
                $product->update([
                    'received_quantity' => $productData['received_quantity'],
                    'is_delivered' => $productData['is_delivered']
                ]);
                if (!$productData['is_delivered']) {
                    $allDelivered = false;
                }
            }

            $newStatus = $allDelivered ? 'completed' : 'partially_received';
            $order->update([
                'general_observations' => $request->general_observations,
                'status' => $newStatus,
                'updated_by' => $user->id,
                'received_at' => Carbon::now()
            ]);

            $log = new OrderLog([
                'order_request_id' => $order->id,
                'user_id' => $user->id,
                'action' => 'products_received',
                'details' => 'Productos recibidos por ' . $user->name . ' ' . ($user->surname ?? '')
            ]);
            $log->save();

            Notification::create([
                'user_id' => $order->created_by,
                'order_request_id' => $order->id,
                'message' => 'Los productos de la orden #' . $order->order_number . ' han sido recibidos.',
                'created_at' => Carbon::now(),
                'type' => 'info',
            ]);

            DB::commit();
            $order->load('createdBy', 'provider', 'requesterArea', 'requesterSubarea', 'products', 'products.marca', 'products.tipo');
            // ← AÑADE ESTO PARA NOTIFICACIÓN EN TIEMPO REAL
            SocketService::sendNotification([
                'title' => 'Productos Recibidos',
                'message' => 'Productos de orden: ' . $order->order_number . 'creada por: ' . $user->name . 'han sido recibidos',
                'type' => 'success',
                'module' => 'ordenes',
                'order_id' => $order->id]
            );
            return response()->json(['message' => 'Productos recibidos exitosamente', 'data' => $order], 200);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Error al recibir productos', 'errors' => $e->getMessage()], 400);
        }
    }

    /**
     * Validar orden por Área 2 (intermedio antes de Área 1)
     * **MODIFICADO**: Fusionado con validateSuficiencia, mantener por compatibilidad
     */
    public function validateArea2(Request $request, $id): JsonResponse
    {
        return $this->validateSuficiencia($request, $id); // **MODIFICADO**: Redirigir a validateSuficiencia
    }

    


    public function saveSuficienciaPdf($id)
    {
        try {
            $order = OrderRequest::with([
                'products',
                'products.marca',
                'products.tipo',
                'products.unit',
                'products.vehicle',
                'provider',
                'requesterArea',
                'requesterSubarea.area'
            ])->findOrFail($id);
            
            $importe_letra = Numbertowords::toCurrencyEs($order->total);
            //$order->importe_letra = NumberToWords::toCurrencyEs($order->total);
        // Render PDF
        
        // ✅ Generar y guardar el PDF de suficiencia
            $pdf = Pdf::loadView('pdf.suficiencia_created', [
                'order'         => $order,
                'importe_letra' => $importe_letra,
                'format_type'   => $order->format_type,
            ])->setPaper('letter', 'landscape');

            // 🔹 Si ya existe un PDF previo, elimínalo
            if ($order->suficiencia_pdf_path && Storage::disk('public')->exists($order->suficiencia_pdf_path)) {
                Storage::disk('public')->delete($order->suficiencia_pdf_path);
            }

            // 🔹 Nombre fijo para sobrescribir siempre el mismo archivo
            $pdfPath = "suficiencias/suficiencia_{$order->id}.pdf";

            // 🔹 Guardar PDF correctamente (sin duplicar “public/”)
            Storage::disk('public')->put($pdfPath, $pdf->output());

            // 🔹 Guardar ruta en base de datos
            $order->suficiencia_pdf_path = $pdfPath;
            $order->save();

            return response()->json([
                'message' => 'PDF de suficiencia generado correctamente',
                'suficiencia_pdf_path' => $pdfPath,
                'order_id' => $order->id,
            ], 200);
        } catch (Throwable $e) {
            Log::error('Error al generar PDF de suficiencia: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString()
            ]);
            return response()->json([
                'message' => 'No se pudo generar el PDF de la Suficiencia Presupuestal'
            ], 500);
        }
    }


    
    public function saveOrderPdf($id)
    {
        try {
            $order = OrderRequest::with([
                'products',
                'products.marca',
                'products.tipo',
                'products.unit',
                'products.vehicle',
                'provider',
                'requesterArea',
                'requesterSubarea.area'
            ])->findOrFail($id);

            $importe_letra = Numbertowords::toCurrencyEs($order->total);

            // ✅ Generar y guardar el PDF de orden
                $pdf = Pdf::loadView('pdf.order_created', [
                    'order'         => $order,
                    'importe_letra' => $importe_letra,
                    'format_type'   => $order->format_type,
                ])->setPaper('letter', 'landscape');

                
                // 🔹 Si ya existe un PDF previo, elimínalo (solo si usas mismo nombre)
                if ($order->pdf_path && Storage::disk('public')->exists($order->pdf_path)) {
                    Storage::disk('public')->delete($order->pdf_path);
                }

                // 🔹 Usa nombre fijo para sobrescribir (si lo deseas)
                $pdfPath = "ordenes/orden_{$order->id}.pdf";

                // 🔹 Guardar correctamente sin duplicar “public/”
                Storage::disk('public')->put($pdfPath, $pdf->output());

                // 🔹 Guardar ruta
                $order->pdf_path = $pdfPath;
                $order->save();

            
            return response()->json([
                'message' => 'PDF de Orden generado correctamente',
                'pdf_path' => $pdfPath,
                'pdf_url' => url('storage/' . $pdfPath),
                'order_id' => $order->id,
                'importe_letra' => $importe_letra
            ], 200);

        } catch (Throwable $e) {
            Log::error('Error al generar PDF de Orden de Pedido', [
                'error' => $e->getMessage(),
                'line' => $e->getLine(),
                'file' => $e->getFile(),
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'message' => 'No se pudo generar el PDF de la Orden de Pedido',
                'error' => $e->getMessage()
            ], 500);
        }
    }


    /**
     * Enviar el PDF al proveedor
     * **MODIFICADO**: Usar OrderLog en lugar de Log y soportar ambos tipos de PDFs
     */
    public function sendPdfToProvider(Request $request, $id): JsonResponse
    {
        $user = auth('api')->user();
        if (!$user || !$user->hasPermissionTo('orders.view')) {
            return response()->json(['message' => 'Acceso no autorizado'], 403);
        }

        $order = OrderRequest::findOrFail($id);

        // Usar de lo contrario pdf_path
        $pdfPath = $order->pdf_path;
        if (!$pdfPath) {
            return response()->json(['message' => 'No se encontró el PDF de la orden de pedido'], 400);
        }

        $provider = Provider::findOrFail($order->provider_id);
        if (!$provider->email) {
            return response()->json(['message' => 'El proveedor no tiene un correo registrado'], 400);
        }

        // Enviar correo al proveedor
        try {
            Mail::to($provider->email)->send(new OrderCreated($order, true)); // true indica que es para el proveedor
            $order->is_pdf_sent = true;
            $order->save();

            // Registrar en el log
            $log = new OrderLog([ // **MODIFICADO**: Usar OrderLog en lugar de Log
                'order_request_id' => $order->id,
                'user_id' => $user->id,
                'action' => 'pdf_sent',
                'details' => 'PDF enviado al proveedor ' . $provider->full_name
            ]);
            $log->save();
            SocketService::sendNotification([
                'title' => 'PDF enviado al Proveedor',
                'message' => 'Orden de pedido. ' . $order->order_number . ' enviado al Proveedor',
                'type' => 'info',
                'module' => 'ordenes',
                'order_id' => $order->id]
            );

            return response()->json(['message' => 'PDF enviado al proveedor exitosamente'], 200);
        } catch (Exception $e) {
            return response()->json(['message' => 'Error al enviar el PDF: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Descargar el PDF
     * **MODIFICADO**: Soportar ambos tipos de PDFs (orden y suficiencia)
     */
    public function getPdf($id): \Illuminate\Http\Response
    {

        $user = auth('api')->user();
        if (!$user || !$user->hasPermissionTo('orders.view')) {
            return response()->json(['message' => 'Acceso no autorizado'], 403);
        }

        $order = OrderRequest::findOrFail($id);

        // Usar suficiencia_pdf_path si existe, de lo contrario pdf_path
        $pdfPath = $order->suficiencia_pdf_path ?? $order->pdf_path;
        if (!$pdfPath) {
            return response()->json(['message' => 'No se encontró el PDF de la orden o suficiencia'], 404);
        }

        $filePath = storage_path('app/' . $pdfPath);
        if (!file_exists($filePath)) {
            return response()->json(['message' => 'El archivo PDF no existe'], 404);
        }

        $filename = $order->suficiencia_pdf_path ? "suficiencia_{$order->foliosf}.pdf" : "order_{$order->order_number}.pdf";
        return response()->file($filePath, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'inline; filename="' . $filename . '"'
        ]);
    }

    public function showSuficiencia($id)
{
    $order = OrderRequest::with([
        'products',
        'products.marca',
        'products.tipo',
        'products.unit',
        'products.vehicle',
        'provider',
        'requesterArea',
        'requesterSubarea.area'
    ])->findOrFail($id);

    // 👇 Genera el importe con letra (maneja millones correctamente: "de pesos")
    $order->importe_letra = Numbertowords::toCurrencyEs($order->total ?? 0);

    return view('pdf.suficiencia_created', compact('order'));
}


    public function delete($id): JsonResponse
    {
        $user = auth('api')->user();

        // 🔒 Validar permisos
        if (!$user || !$user->hasPermissionTo('orders.delete')) {
            return response()->json(['message' => 'Acceso no autorizado'], 403);
        }

        $order = OrderRequest::with('products')->find($id);

        if (!$order) {
            return response()->json(['message' => 'Orden no encontrada'], 404);
        }

        // 🚫 Controlar que solo se puedan eliminar órdenes en estados permitidos
        $allowedStatuses = ['pending_sf_validation', 'validate_sf', 'pending_warehouse'];
        if (!in_array($order->status, $allowedStatuses)) {
            return response()->json([
                'message' => 'No se puede eliminar esta orden, ya fue procesada o completada.'
            ], 400);
        }

        DB::beginTransaction();
        try {
            // 🧹 Eliminar PDF asociado (si existe)
            if ($order->pdf_path && Storage::disk('public')->exists($order->pdf_path)) {
                Storage::disk('public')->delete($order->pdf_path);
            }
            if ($order->suficiencia_pdf_path && Storage::disk('public')->exists($order->suficiencia_pdf_path)) {
                Storage::disk('public')->delete($order->suficiencia_pdf_path);
            }

            // 🗑️ Eliminar productos asociados
            OrderProduct::where('order_request_id', $order->id)->delete();

            // 🧾 Registrar log
            OrderLog::create([
                'order_request_id' => $order->id,
                'user_id' => $user->id,
                'action' => 'deleted',
                'details' => 'Orden eliminada por ' . $user->name . ' ' . ($user->surname ?? '')
            ]);

            // 🔔 Crear notificación
            Notification::create([
                'user_id' => $order->created_by,
                'order_request_id' => $order->id,
                'message' => 'La orden o suficiencia ' . ($order->foliosf ?? $order->order_number ?? $order->id) . ' fue eliminada por ' . $user->name,
                'created_at' => Carbon::now(),
                'type' => 'info',
            ]);

            // 🔥 Eliminar la orden principal
            $order->delete();

            DB::commit();

            // 🟢 Notificación en tiempo real (si usas sockets)
            SocketService::sendNotification([
                'title' => 'Orden eliminada',
                'message' => 'La orden o suficiencia ' . ($order->foliosf ?? $order->order_number ?? '') . ' fue eliminada correctamente por ' . $user->name,
                'type' => 'warning',
                'module' => 'ordenes',
                'order_id' => $id
            ]);

            return response()->json([
                'message' => 'Orden eliminada exitosamente.',
                'deleted_id' => $id
            ], 200);
        } catch (Throwable $e) {
            DB::rollBack();
            Log::error('Error al eliminar la orden: ' . $e->getMessage(), ['trace' => $e->getTraceAsString()]);
            return response()->json([
                'message' => 'Error al eliminar la orden.',
                'error' => $e->getMessage()
            ], 500);
        }
    }

}






/*
    
    public function assignPartidas(Request $request, $id): JsonResponse
    {
        $user = auth('api')->user();
        if (!$user || !$user->hasPermissionTo('orders.assign_partidas')) {
            return response()->json(['message' => 'Acceso no autorizado'], 403);
        }

        $order = OrderRequest::findOrFail($id);
        if ($order->status !== 'pending_sf_validation') {
            return response()->json(['message' => 'La orden no está en estado para asignar partidas'], 403);
        }

        $validator = Validator::make($request->all(), [
            'subsidio_estatal' => 'boolean',
            'ingresos_propios' => 'boolean',
            'federal' => 'boolean',
            'mixto' => 'boolean',
            'products' => 'required|array',
            'products.*.id' => 'required|exists:order_products,id',
            'products.*.partida' => 'required|string|max:50', 
            'products.*.observations' => 'nullable|string|max:250'
        ]);

        if ($validator->fails()) {
            return response()->json(['message' => 'Validación fallida', 'errors' => $validator->errors()], 400);
        }

        DB::beginTransaction();
        try {
            $order->update([
                'subsidio_estatal' => $request->subsidio_estatal,
                'ingresos_propios' => $request->ingresos_propios,
                'federal' => $request->federal,
                'mixto' => $request->mixto,
                'status' => 'sf_validated',
                'updated_by' => $user->id
            ]);

            foreach ($request->products as $productData) {
                $product = OrderProduct::findOrFail($productData['id']);
                $product->update([
                    'partida' => $productData['partida'],
                    'observations' => $productData['observations'] ?? null
                ]);
            }

            $log = new OrderLog([
                'order_request_id' => $order->id,
                'user_id' => $user->id,
                'action' => 'partidas_assigned',
                'details' => 'Partidas asignadas por ' . $user->name . ' ' . ($user->surname ?? '')
            ]);
            $log->save();

            // Notificación para el creador y área 2
            $permission = Permission::where('name', 'orders.assign_partidas')->first();
            $area2Users = $permission ? $permission->users()->get() : collect();

            foreach ($area2Users as $area2User) {
                Notification::create([
                    'user_id' => $area2User->id,
                    'order_request_id' => $order->id,
                    'message' => 'Las partidas para S.F. #' . $order->foliosf . ' han sido asignadas.',
                    'created_at' => Carbon::now()
                ]);
            }

            DB::commit();
            $order->load('createdBy', 'provider', 'requesterArea', 'requesterSubarea', 'products', 'products.marca', 'products.tipo');
            // ← AÑADE ESTO PARA NOTIFICACIÓN EN TIEMPO REAL
            SocketService::sendNotification([
                'title' => 'Partidas asignadas por Contabilidad',
                'message' => 'Las partidas para el ' . $order->foliosf . ' han sido asignadas  por' . $user->name, 
                'type' => 'info',
                'module' => 'ordenes',
                'order_id' => $order->id]
            );
            return response()->json(['message' => 'Partidas asignadas exitosamente', 'data' => $order], 200);
        } catch (Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Error al asignar partidas', 'errors' => $e->getMessage()], 400);
        }
    } */
