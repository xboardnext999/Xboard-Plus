<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class GroupBuyMember extends Model
{
    protected $table = 'v2_group_buy_member';
    protected $dateFormat = 'U';
    protected $guarded = ['id'];
    protected $casts = [
        'group_id' => 'integer',
        'user_id' => 'integer',
        'order_id' => 'integer',
        'status' => 'integer',
        'created_at' => 'timestamp',
        'updated_at' => 'timestamp',
    ];

    public const STATUS_JOINED = 1;
    public const STATUS_PAID = 2;

    public function group(): BelongsTo
    {
        return $this->belongsTo(GroupBuyGroup::class, 'group_id', 'id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id', 'id');
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class, 'order_id', 'id');
    }
}
