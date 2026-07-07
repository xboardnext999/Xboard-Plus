<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class GroupBuyGroup extends Model
{
    protected $table = 'v2_group_buy_group';
    protected $dateFormat = 'U';
    protected $guarded = ['id'];
    protected $casts = [
        'activity_id' => 'integer',
        'leader_user_id' => 'integer',
        'status' => 'integer',
        'required_count' => 'integer',
        'current_count' => 'integer',
        'expired_at' => 'integer',
        'created_at' => 'timestamp',
        'updated_at' => 'timestamp',
    ];

    public const STATUS_OPEN = 1;
    public const STATUS_COMPLETED = 2;
    public const STATUS_EXPIRED = 3;

    public function activity(): BelongsTo
    {
        return $this->belongsTo(GroupBuyActivity::class, 'activity_id', 'id');
    }

    public function leader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'leader_user_id', 'id');
    }

    public function members(): HasMany
    {
        return $this->hasMany(GroupBuyMember::class, 'group_id', 'id');
    }

    public function isOpen(): bool
    {
        return (int) $this->status === self::STATUS_OPEN
            && (!$this->expired_at || (int) $this->expired_at >= time());
    }
}
