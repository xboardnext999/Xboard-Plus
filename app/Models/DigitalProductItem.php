<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DigitalProductItem extends Model
{
    protected $table = 'v2_digital_product_item';
    protected $dateFormat = 'U';
    protected $guarded = ['id'];
    public const AVAILABLE = 'available';
    public const SOLD = 'sold';
    protected $casts = ['sold_at' => 'timestamp', 'created_at' => 'timestamp', 'updated_at' => 'timestamp'];

    public function plan() { return $this->belongsTo(Plan::class); }
    public function order() { return $this->belongsTo(Order::class); }
    public function user() { return $this->belongsTo(User::class); }
}
