<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class DigitalProductCategory extends Model
{
    protected $table = 'v2_digital_product_category';
    protected $dateFormat = 'U';
    protected $fillable = ['name', 'enabled', 'sort'];
    protected $casts = ['enabled' => 'boolean', 'sort' => 'integer'];

    public function plans(): HasMany
    {
        return $this->hasMany(Plan::class, 'digital_category_id');
    }
}
