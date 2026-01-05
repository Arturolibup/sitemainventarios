<?php

namespace App\Http\Controllers\OP;

use App\Models\Car\Car;
use Illuminate\Support\Str;
use App\Models\Product\Tipo;
use Illuminate\Http\Request;
use App\Models\Product\Marca;
use Illuminate\Validation\Rule;
use App\Models\Configuration\Area;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use App\Http\Controllers\Controller;
use App\Models\Configuration\Subarea;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use App\Models\OP\Invoice;
use App\Models\OP\OrderRequest;
use App\Models\Configuration\Provider;
use Illuminate\Support\Facades\Validator;


class InvoiceController extends Controller
{
    /**
     * Listar facturas con paginación y búsqueda por order_request_id.
     */
    public function index(Request $request)
    {
        Log::info('Solicitud para listar facturas:', $request->all());

        $validated = $request->validate([
            'order_request_id' => 'sometimes|exists:order_requests,id',
            'search' => 'sometimes|string|nullable|max:100',
            'per_page' => 'sometimes|integer|min:1|max:100',
        ]);

        $orderRequestId = $validated['order_request_id'] ?? null;
        $search = $validated['search'] ?? '';
        $perPage = $validated['per_page'] ?? 25;

        $query = Invoice::query()
            ->with(['orderRequest', 'provider', 'createdBy', 'updatedBy'])
            ->when($orderRequestId, fn($q) => $q->where('order_request_id', $orderRequestId))
            ->when($search, function ($q) use ($search) {
                $q->whereHas('provider', fn($q) => $q->where('full_name', 'LIKE', "%$search%"))
                  ->orWhere('file_path', 'LIKE', "%$search%");
            })
            ->orderBy('created_at', 'desc');

        $invoices = $query->paginate($perPage);

        return response()->json([
            'meta' => [
                'total' => $invoices->total(),
                'per_page' => $invoices->perPage(),
                'current_page' => $invoices->currentPage(),
                'last_page' => $invoices->lastPage(),
                'search_term' => $search,
            ],
            'data' => $invoices->map(function ($invoice) {
                return [
                    'id' => $invoice->id,
                    'order_request_id' => $invoice->order_request_id,
                    'order_request' => $invoice->orderRequest ? [
                        'id' => $invoice->orderRequest->id,
                        'order_number' => $invoice->orderRequest->order_number,
                    ] : null,
                    'provider_id' => $invoice->provider_id,
                    'provider' => $invoice->provider ? [
                        'id' => $invoice->provider->id,
                        'full_name' => $invoice->provider->full_name,
                    ] : null,
                    'file_path' => $invoice->file_path ? env('APP_URL') . 'storage/' . $invoice->file_path : null,
                    'photos' => $invoice->photos ? array_map(fn($path) => env('APP_URL') . 'storage/' . $path, $invoice->photos) : [],
                    'created_by' => $invoice->createdBy ? [
                        'id' => $invoice->createdBy->id,
                        'name' => $invoice->createdBy->name,
                    ] : null,
                    'updated_by' => $invoice->updatedBy ? [
                        'id' => $invoice->updatedBy->id,
                        'name' => $invoice->updatedBy->name,
                    ] : null,
                    'created_at' => $invoice->created_at->format('Y-m-d H:i'),
                    'updated_at' => $invoice->updated_at ? $invoice->updated_at->format('Y-m-d H:i') : null,
                ];
            }),
        ]);
    }

    /**
     * Cargar factura (PDF) y fotos de productos.
     */
    public function store(Request $request)
    {
        Log::info('Solicitud para cargar factura:', $request->all());

        try {
            $validated = $request->validate([
                'order_request_id' => 'required|exists:order_requests,id',
                'provider_id' => 'required|exists:providers,id',
                'invoice_file' => 'required|file|mimes:pdf|max:2048',
                'photos.*' => 'nullable|image|mimes:jpeg,png,jpg,gif,webp|max:2048',
            ]);

            return DB::transaction(function () use ($request, $validated) {
                $filePath = $request->file('invoice_file')->store('invoices', 'public');
                Log::info('Factura almacenada:', ['path' => $filePath]);

                $photos = [];
                if ($request->hasFile('photos')) {
                    foreach ($request->file('photos') as $photo) {
                        $photoPath = $photo->store('invoice_photos', 'public');
                        $photos[] = $photoPath;
                        Log::info('Foto almacenada:', ['path' => $photoPath]);
                    }
                }

                $invoice = Invoice::create([
                    'order_request_id' => $request->order_request_id,
                    'file_path' => $filePath,
                    'provider_id' => $request->provider_id,
                    'photos' => $photos,
                    'created_by' => auth()->id(),
                    'updated_by' => auth()->id(),
                    //'provider_id' => $validated['provider_id'],
                ]);

                Log::info('Factura creada:', ['id' => $invoice->id]);

                return response()->json([
                    'message' => 'Factura cargada con éxito.',
                    'invoice' => [
                        'id' => $invoice->id,
                        'order_request_id' => $invoice->order_request_id,
                        'provider_id' => $invoice->provider_id,
                        'file_path' => env('APP_URL') . 'storage/' . $invoice->file_path,
                        'photos' => array_map(fn($path) => env('APP_URL') . 'storage/' . $path, $invoice->photos ?: []),
                        'created_at' => $invoice->created_at->format('Y-m-d H:i'),
                    ],
                ], 201);
            });
        } catch (ValidationException $e) {
            Log::error('Validación fallida al cargar factura:', ['errors' => $e->errors()]);
            return response()->json(['errors' => $e->errors()], 422);
        } catch (\Exception $e) {
            Log::error('Error al cargar factura:', ['message' => $e->getMessage()]);
            return response()->json(['message' => 'Error al cargar factura: ' . $e->getMessage()], 422);
        }
    }

    /**
     * Mostrar detalles de una factura.
     */
    public function show($id)
    {
        $invoice = Invoice::with(['orderRequest', 'provider', 'createdBy', 'updatedBy'])->findOrFail($id);

        return response()->json([
            'invoice' => [
                'id' => $invoice->id,
                'order_request_id' => $invoice->order_request_id,
                'order_request' => $invoice->orderRequest ? [
                    'id' => $invoice->orderRequest->id,
                    'order_number' => $invoice->orderRequest->order_number,
                ] : null,
                'provider_id' => $invoice->provider_id,
                'provider' => $invoice->provider ? [
                    'id' => $invoice->provider->id,
                    'full_name' => $invoice->provider->full_name,
                ] : null,
                'file_path' => $invoice->file_path ? env('APP_URL') . 'storage/' . $invoice->file_path : null,
                'photos' => $invoice->photos ? array_map(fn($path) => env('APP_URL') . 'storage/' . $path, $invoice->photos) : [],
                'created_by' => $invoice->createdBy ? [
                    'id' => $invoice->createdBy->id,
                    'name' => $invoice->createdBy->name,
                ] : null,
                'updated_by' => $invoice->updatedBy ? [
                    'id' => $invoice->updatedBy->id,
                    'name' => $invoice->updatedBy->name,
                ] : null,
                'created_at' => $invoice->created_at->format('Y-m-d H:i'),
                'updated_at' => $invoice->updated_at ? $invoice->updated_at->format('Y-m-d H:i') : null,
            ],
        ]);
    }

    /**
     * Actualizar factura (PDF y/o fotos).
     */
    public function update(Request $request, $id)
    {
        $invoice = Invoice::findOrFail($id);
        Log::info('Solicitud para actualizar factura:', $request->all());

        try {
            $validated = $request->validate([
                'order_request_id' => 'required|exists:order_requests,id',
                'provider_id' => 'required|exists:providers,id',
                'invoice_file' => 'nullable|file|mimes:pdf|max:2048',
                'photos.*' => 'nullable|image|mimes:jpeg,png,jpg,gif,webp|max:2048',
            ]);

            return DB::transaction(function () use ($request, $validated, $invoice) {
                $filePath = $invoice->file_path;
                if ($request->hasFile('invoice_file')) {
                    if ($filePath) {
                        Storage::disk('public')->delete($filePath);
                    }
                    $filePath = $request->file('invoice_file')->store('invoices', 'public');
                    Log::info('Factura actualizada:', ['path' => $filePath]);
                }

                $photos = $invoice->photos ?: [];
                if ($request->hasFile('photos')) {
                    // Opcional: Eliminar fotos antiguas si se desea reemplazar
                    foreach ($photos as $photo) {
                        Storage::disk('public')->delete($photo);
                    }
                    $photos = [];
                    foreach ($request->file('photos') as $photo) {
                        $photoPath = $photo->store('invoice_photos', 'public');
                        $photos[] = $photoPath;
                        Log::info('Foto actualizada:', ['path' => $photoPath]);
                    }
                }

                $invoice->update([
                    'order_request_id' => $validated['order_request_id'],
                    'provider_id' => $validated['provider_id'],
                    'file_path' => $filePath,
                    'photos' => $photos,
                    'updated_by' => auth()->id(),
                ]);

                Log::info('Factura actualizada:', ['id' => $invoice->id]);

                return response()->json([
                    'message' => 'Factura actualizada con éxito.',
                    'invoice' => [
                        'id' => $invoice->id,
                        'order_request_id' => $invoice->order_request_id,
                        'provider_id' => $invoice->provider_id,
                        'file_path' => env('APP_URL') . 'storage/' . $invoice->file_path,
                        'photos' => array_map(fn($path) => env('APP_URL') . 'storage/' . $path, $invoice->photos ?: []),
                        'created_at' => $invoice->created_at->format('Y-m-d H:i'),
                        'updated_at' => $invoice->updated_at->format('Y-m-d H:i'),
                    ],
                ]);
            });
        } catch (ValidationException $e) {
            Log::error('Validación fallida al actualizar factura:', ['errors' => $e->errors()]);
            return response()->json(['errors' => $e->errors()], 422);
        } catch (\Exception $e) {
            Log::error('Error al actualizar factura:', ['message' => $e->getMessage()]);
            return response()->json(['message' => 'Error al actualizar factura: ' . $e->getMessage()], 422);
        }
    }

    /**
     * Eliminar factura (soft delete).
     */
    public function destroy($id)
    {
        $invoice = Invoice::findOrFail($id);
        Log::info('Solicitud para eliminar factura:', ['id' => $id]);

        if ($invoice->file_path) {
            Storage::disk('public')->delete($invoice->file_path);
        }
        foreach ($invoice->photos ?: [] as $photo) {
            Storage::disk('public')->delete($photo);
        }

        $invoice->delete();
        Log::info('Factura eliminada (soft delete):', ['id' => $id]);

        return response()->json(['message' => 'Factura eliminada con éxito.'], 200);
    }


    //exclusivo para fotos y documentos
    

    public function deletePhoto(Request $request, $id)
    {
        $invoice = Invoice::findOrFail($id);

        $request->validate([
            'path' => 'required|string',
        ]);

        $pathPublic = str_replace(env('APP_URL') . 'storage/', '', $request->input('path'));
        $photos = $invoice->photos ?: [];

        if (!in_array($pathPublic, $photos)) {
            return response()->json(['message' => 'La foto no pertenece a esta factura'], 422);
        }

        return DB::transaction(function () use ($invoice, $photos, $pathPublic) {
            // Eliminar del disco
            Storage::disk('public')->delete($pathPublic);

            // Actualizar arreglo
            $updated = array_values(array_filter($photos, fn($p) => $p !== $pathPublic));
            $invoice->update([
                'photos' => $updated,
                'updated_by' => auth()->id(),
            ]);

            return response()->json([
                'message' => 'Foto eliminada con éxito.',
                'invoice' => $this->mapInvoiceResponse($invoice->fresh(['orderRequest','provider','createdBy','updatedBy'])),
            ]);
        });
    }

    public function replaceFile(Request $request, $id)
    {
        $invoice = Invoice::findOrFail($id);
        
        $request->validate([
            'invoice_file' => 'required|file|mimes:pdf,doc,docx,xls,xlsx,jpg,jpeg,png|max:5120'
        ]);
        
        // Eliminar el archivo anterior si existe
        if ($invoice->file_path && Storage::exists($invoice->file_path)) {
            Storage::delete($invoice->file_path);
        }
        
        // Guardar el nuevo archivo
        $filePath = $request->file('invoice_file')->store('invoices', 'public');
        $invoice->file_path = $filePath;
        $invoice->save();
        
        return response()->json([
            'success' => true,
            'message' => 'Documento reemplazado correctamente',
            'invoice' => $invoice
        ]);
    }

    public function appendPhotos(Request $request, $id)
        {
            $invoice = Invoice::find($id);
            
            if (!$invoice) {
                return response()->json([
                    'success' => false,
                    'message' => 'Factura no encontrada'
                ], 404);
            }

            $request->validate([
                'photos' => 'required|array',
                'photos.*' => 'image|mimes:jpeg,png,jpg,gif,webp|max:2048' // Agregué webp
            ]);

            $newPhotos = [];
            
            if ($request->hasFile('photos')) {
                foreach ($request->file('photos') as $photo) {
                    // ✅ GUARDAR SOLO LA RUTA RELATIVA
                    $photoPath = $photo->store('invoice_photos', 'public');
                    $newPhotos[] = $photoPath; // ← Solo la ruta relativa
                }
            }

            // Obtener fotos existentes (pueden ser rutas relativas o URLs completas por errores previos)
            $existingPhotos = $invoice->photos ?? [];
            
            // ✅ LIMPIAR FOTOS EXISTENTES: convertir cualquier URL a ruta relativa
            $cleanedExistingPhotos = array_map(function($photo) {
                // Si es una URL completa, extraer la ruta relativa
                if (filter_var($photo, FILTER_VALIDATE_URL)) {
                    // Extraer la parte después de '/storage/'
                    $parts = parse_url($photo);
                    $path = $parts['path'] ?? '';
                    return str_replace('/storage/', '', $path);
                }
                // Si ya es ruta relativa, dejarla igual
                return $photo;
            }, $existingPhotos);

            $allPhotos = array_merge($cleanedExistingPhotos, $newPhotos);
            
            $invoice->photos = $allPhotos;
            $invoice->save();

            // 🔹 DEVOLVER EL INVOICE COMPLETO (con file_path y todo lo demás)
                return response()->json([
                    'success' => true,
                    'message' => 'Fotos agregadas correctamente',
                    'invoice' => $this->mapInvoiceResponse(
                        $invoice->fresh(['orderRequest','provider','createdBy','updatedBy'])
                    )
                ]);
        }

    
    
        public function deleteFile($id)
    {
        $invoice = Invoice::findOrFail($id);

        return DB::transaction(function () use ($invoice) {
            if ($invoice->file_path) {
                Storage::disk('public')->delete($invoice->file_path);
            }
            $invoice->update([
                'file_path' => null,
                'updated_by' => auth()->id(),
            ]);

            return response()->json([
                'message' => 'Documento eliminado con éxito.',
                'invoice' => $this->mapInvoiceResponse($invoice->fresh(['orderRequest','provider','createdBy','updatedBy'])),
            ]);
        });
    }

    /**
     * Helper para formatear la respuesta de una factura (reutilizable)
     */
    private function mapInvoiceResponse(Invoice $invoice)
    {
        return [
            'id' => $invoice->id,
            'order_request_id' => $invoice->order_request_id,
            'provider_id' => $invoice->provider_id,
            'file_path' => $invoice->file_path ? env('APP_URL') . 'storage/' . $invoice->file_path : null,
            'photos' => $invoice->photos ? array_map(fn($p) => env('APP_URL') . 'storage/' . $p, $invoice->photos) : [],
            'provider' => $invoice->provider ? [
                'id' => $invoice->provider->id,
                'name' => $invoice->provider->name ?? $invoice->provider->full_name ?? null,
            ] : null,
            'created_at' => optional($invoice->created_at)->format('Y-m-d H:i'),
            'updated_at' => optional($invoice->updated_at)->format('Y-m-d H:i'),
        ];
    }
}