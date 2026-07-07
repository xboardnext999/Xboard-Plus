<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SubscriptionFreeze extends Model
{
    protected $table = 'v2_subscription_freeze';
    protected $dateFormat = 'U';
    protected $guarded = ['id'];
    protected $casts = [
        'started_at' => 'integer',
        'ended_at' => 'integer',
        'days' => 'integer',
        'status' => 'integer',
        'created_at' => 'timestamp',
        'updated_at' => 'timestamp',
    ];

    public const STATUS_FROZEN = 1;
    public const STATUS_UNFROZEN = 2;

    public function subscription(): BelongsTo
    {
        return $this->belongsTo(UserSubscription::class, 'subscription_id', 'id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id', 'id');
    }
}
