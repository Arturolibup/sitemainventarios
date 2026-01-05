<?php

namespace App\Models\Product;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class EntryEvidence extends Model
{
    use HasFactory;
    use SoftDeletes;

    protected $table = 'entry_evidences';
    protected $fillable = ['entry_id', 'file_path', 'file_type', 'file_size', 'original_name'];

    
    public function setCreatedAtAttribute($value){
        date_default_timezone_set("America/Mazatlan");
        
        $this-> attributes["created_at"] = Carbon::now();
        
    }
    
    public function setUpdatedAtAttribute($value){
        date_default_timezone_set("America/Mazatlan");
        
        $this-> attributes["updated_at"] = Carbon::now();
    }
    
    
    public function productEntry()
    {
        return $this->belongsTo(ProductEntry::class, 'entry_id');
    }

}
