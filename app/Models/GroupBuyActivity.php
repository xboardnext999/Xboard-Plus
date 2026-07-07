<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class GroupBuyActivity extends Model
{
    protected $table = 'v2_group_buy_activity';
    protected $dateFormat = 'U';
    protected $guarded = ['id'];
    protected $casts = [
        'plan_id' => 'integer',
        'group_size' => 'integer',
        'discount_type' => 'integer',
        'discount_value' => 'integer',
        'started_at' => 'integer',
        'ended_at' => 'integer',
        'expire_minutes' => 'integer',
        'status' => 'integer',
        'created_at' => 'timestamp',
        'updated_at' => 'timestamp',
    ];

    public const STATUS_DISABLED = 0;
    public const STATUS_ENABLED = 1;
    public const DISCOUNT_FIXED = 1;
    public const DISCOUNT_PERCENT = 2;

    public function plan(): BelongsTo
    {
        return $this->belongsTo(Plan::class, 'plan_id', 'id');
    }

    public function groups(): HasMany
    {
        return $this->hasMany(GroupBuyGroup::class, 'activity_id', 'id');
    }

    public function isAvailable(): bool
    {
        $now = time();
        return (int) $this->status === self::STATUS_ENABLED
            && (!$this->started_at || (int) $this->started_at <= $now)
            && (!$this->ended_at || (int) $this->ended_at >= $now);
    }
}
