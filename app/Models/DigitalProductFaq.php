<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DigitalProductFaq extends Model
{
    protected $table = 'v2_digital_product_faq';
    protected $dateFormat = 'U';
    protected $fillable = ['title', 'content', 'enabled', 'sort'];
    protected $casts = ['enabled' => 'boolean', 'sort' => 'integer'];
}
