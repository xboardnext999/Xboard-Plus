<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AdminAccessProfile extends Model
{
    protected $table = 'v2_admin_access_profile';
    protected $dateFormat = 'U';
    protected $guarded = ['id'];
    protected $casts = ['permissions' => 'array', 'allowed_ips' => 'array', 'active' => 'boolean', 'expires_at' => 'timestamp', 'created_at' => 'timestamp', 'updated_at' => 'timestamp'];
    public function user() { return $this->belongsTo(User::class, 'user_id'); }
    public function creator() { return $this->belongsTo(User::class, 'created_by'); }
    public function isUsableFor(?string $ip = null): bool
    {
        if (!$this->active || (int) $this->getRawOriginal('expires_at') <= time() || $this->login_count > $this->max_logins) return false;
        $ips = array_values(array_filter($this->allowed_ips ?: []));
        return !$ips || ($ip !== null && in_array($ip, $ips, true));
    }
}
