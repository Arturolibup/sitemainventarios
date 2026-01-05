<?php

namespace App\Models\Product;

use App\Models\Product\ProductEntry;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class PurchaseDocument extends Model
{
    use HasFactory;
    protected $fillable = [
        'entry_id',
        'file_path',
        'file_type',
        'file_size',
        'original_name',
        'is_auto_pdf' // Marcar como PDF automático
        
    ];

    protected $casts = [
        'entry_id' => 'integer',
        'file_size' => 'integer',
        'is_auto_pdf' => 'boolean'
    ];

    public function entry()
    {
        return $this->belongsTo(ProductEntry::class, 'entry_id');
    }

    
}
    

