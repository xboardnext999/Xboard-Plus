<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Recharge extends Model
{
    protected $table = 'v2_recharge';
    protected $dateFormat = 'U';
    protected $guarded = ['id'];
    protected $casts = [
        'created_at' => 'timestamp',
        'updated_at' => 'timestamp',
        'paid_at' => 'timestamp',
        'amount' => 'integer',
        'handling_amount' => 'integer',
        'status' => 'integer',
    ];

    const STATUS_PENDING = 0;
    const STATUS_PROCESSING = 1;
    const STATUS_CANCELLED = 2;
    const STATUS_COMPLETED = 3;

    public static $statusMap = [
        self::STATUS_PENDING => '待支付',
        self::STATUS_PROCESSING => '处理中',
        self::STATUS_CANCELLED => '已取消',
        self::STATUS_COMPLETED => '已完成',
    ];

    public function payment(): BelongsTo
    {
        return $this->belongsTo(Payment::class, 'payment_id', 'id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id', 'id');
    }
}
