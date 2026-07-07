<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class UserSubscription extends Model
{
    protected $table = 'v2_user_subscription';
    protected $dateFormat = 'U';
    protected $guarded = ['id'];
    protected $casts = [
        'transfer_enable' => 'integer',
        'used_traffic' => 'integer',
        'speed_limit' => 'integer',
        'device_limit' => 'integer',
        'started_at' => 'integer',
        'expired_at' => 'integer',
        'status' => 'integer',
        'is_primary' => 'boolean',
        'frozen_at' => 'integer',
        'freeze_ends_at' => 'integer',
        'freeze_used_days' => 'integer',
        'freeze_count' => 'integer',
        'metadata' => 'array',
        'created_at' => 'timestamp',
        'updated_at' => 'timestamp',
    ];

    public const STATUS_ACTIVE = 1;
    public const STATUS_FROZEN = 2;
    public const STATUS_EXPIRED = 3;
    public const STATUS_CANCELLED = 4;

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id', 'id');
    }

    public function plan(): BelongsTo
    {
        return $this->belongsTo(Plan::class, 'plan_id', 'id');
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class, 'order_id', 'id');
    }

    public function freezes(): HasMany
    {
        return $this->hasMany(SubscriptionFreeze::class, 'subscription_id', 'id');
    }

    public function isExpired(): bool
    {
        return $this->expired_at !== null && (int) $this->expired_at < time();
    }

    public function isAvailable(): bool
    {
        return (int) $this->status === self::STATUS_ACTIVE && !$this->isExpired();
    }
}
