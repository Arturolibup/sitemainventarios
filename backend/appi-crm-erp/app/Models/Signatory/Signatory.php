<?php

namespace App\Models\Signatory;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class Signatory extends Model
{
    use HasFactory, SoftDeletes;

    // Nombre real de la tabla
    protected $table = 'departament_signatories';

    // Campos que se pueden asignar masivamente
    protected $fillable = [
        'departament',
        'position',
        'name',
        'title',
        'is_active',
        'order'
    ];

    // Casts
    protected $casts = [
        'is_active' => 'boolean',
        'order' => 'integer'
    ];

    // ===================================================================
    // SCOPES PARA BÚSQUEDAS
    // ===================================================================

    /**
     * Scope para activos
     */
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    /**
     * Scope para ordenar por prioridad
     */
    public function scopeOrdered($query)
    {
        return $query->orderBy('order')->orderBy('name');
    }

    /**
     * Scope para búsqueda por departamento
     */
    public function scopeByDepartment($query, $department)
    {
        return $query->where('departament', 'like', "%$department%");
    }

    /**
     * Scope para búsqueda por cargo
     */
    public function scopeByPosition($query, $position)
    {
        return $query->where('position', 'like', "%$position%");
    }

    // ===================================================================
    // MÉTODOS ESTÁTICOS PRINCIPALES (ÚNICA VERSIÓN)
    // ===================================================================

    /**
     * Obtener jefe de recursos materiales (versión flexible)
     * Busca por departamento O por cargo
     */
    public static function jefeRecursosMateriales()
    {
        return self::where(function($query) {
                    // Buscar por departamento
                    $query->where('departament', 'like', '%recursos%materiales%')
                          ->orWhere('departament', 'like', '%materiales%')
                          // O buscar por cargo
                          ->orWhere('position', 'like', '%jefe%recursos%materiales%')
                          ->orWhere('position', 'like', '%jefe%materiales%');
                })
                ->active()
                ->ordered()
                ->first();
    }

    /**
     * Obtener director general (versión flexible)
     */
    public static function directorGeneral()
    {
        return self::where(function($query) {
                    $query->where('departament', 'like', '%direccion%general%')
                          ->orWhere('departament', 'like', '%director%general%')
                          ->orWhere('position', 'like', '%director%general%');
                })
                ->active()
                ->ordered()
                ->first();
    }

    /**
     * Obtener encargado/jefe de almacén
     */
    public static function encargadoAlmacen()
    {
        return self::where(function($query) {
                    $query->where('departament', 'like', '%almacen%')
                          ->orWhere('position', 'like', '%encargado%almacen%')
                          ->orWhere('position', 'like', '%jefe%almacen%');
                })
                ->active()
                ->ordered()
                ->first();
    }

    /**
     * Método genérico para obtener cualquier firmante
     * 
     * @param string $type Tipo de búsqueda: 'department' o 'position'
     * @param string $value Valor a buscar
     * @param bool $activeOnly Solo activos (true por defecto)
     * @return Signatory|null
     */
    public static function getFirmante($type, $value, $activeOnly = true)
    {
        $query = self::query();
        
        if ($type === 'department') {
            $query->where('departament', 'like', "%$value%");
        } elseif ($type === 'position') {
            $query->where('position', 'like', "%$value%");
        } else {
            return null;
        }
        
        if ($activeOnly) {
            $query->active();
        }
        
        return $query->ordered()->first();
    }

    /**
     * Obtener todos los firmantes activos de un departamento
     */
    public static function getFirmantesDepartamento($departamento, $activeOnly = true)
    {
        $query = self::where('departament', 'like', "%$departamento%");
        
        if ($activeOnly) {
            $query->active();
        }
        
        return $query->ordered()->get();
    }

    // ===================================================================
    // MÉTODOS DE INSTANCIA (PARA USO EN BLADES/PDFs)
    // ===================================================================

    /**
     * Formatear nombre completo con título
     */
    public function getNombreCompleto()
    {
        $nombre = $this->name;
        
        if (!empty($this->title)) {
            $nombre = $this->title . '. ' . $nombre;
        }
        
        return $nombre;
    }

    /**
     * Formatear firma para PDF
     * @return array Datos formateados para PDF
     */
    public function toPdfFormat()
    {
        return [
            'nombre' => $this->getNombreCompleto(),
            'cargo' => $this->position,
            'departamento' => $this->departament,
            'es_activo' => $this->is_active,
        ];
    }

    /**
     * Verificar si el firmante puede ser usado
     * (no está eliminado y está activo)
     */
    public function puedeUsarse()
    {
        return !$this->trashed() && $this->is_active;
    }
}