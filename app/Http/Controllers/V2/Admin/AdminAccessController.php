<?php

namespace App\Http\Controllers\V2\Admin;

use App\Http\Controllers\Controller;
use App\Models\AdminAccessProfile;
use App\Models\User;
use App\Services\AuthService;
use App\Utils\Helper;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class AdminAccessController extends Controller
{
    public function index()
    {
        return $this->success(AdminAccessProfile::with(['user:id,email,last_login_at', 'creator:id,email'])->orderByDesc('id')->get());
    }

    public function me(Request $request)
    {
        $profile = $request->attributes->get('admin_access_profile');
        return $this->success(['temporary' => (bool) $profile, 'permissions' => $profile?->permissions]);
    }

    public function save(Request $request)
    {
        $data = $request->validate([
            'id' => 'nullable|integer|exists:v2_admin_access_profile,id', 'email' => 'required|email|max:255', 'password' => 'nullable|string|min:12|max:128',
            'expires_at' => 'required|date|after:now', 'max_logins' => 'required|integer|min:1|max:1000', 'active' => 'required|boolean',
            'allowed_ips' => 'nullable|array|max:20', 'allowed_ips.*' => 'ip', 'permissions' => 'required|array|min:1', 'permissions.*' => 'in:read,write',
        ]);
        $profile = isset($data['id']) ? AdminAccessProfile::findOrFail($data['id']) : null;
        $existing = User::byEmail($data['email'])->first();
        if (!$profile && $existing) return response()->json(['message' => '该邮箱已存在'], 422);
        if ($profile && $existing && $existing->id !== $profile->user_id) return response()->json(['message' => '该邮箱已被其他账号使用'], 422);
        $generated = null;
        DB::transaction(function () use ($request, $data, &$profile, &$generated) {
            if (!$profile) {
                $generated = $data['password'] ?: Str::random(20);
                $user = User::create(['email' => $data['email'], 'password' => password_hash($generated, PASSWORD_DEFAULT), 'uuid' => Helper::guid(), 'token' => Helper::guid(), 'is_admin' => 1, 'is_staff' => 1]);
                $profile = new AdminAccessProfile(['user_id' => $user->id, 'created_by' => $request->user()->id, 'login_count' => 0]);
            } else {
                $user = $profile->user;
                $user->email = $data['email'];
                if (!empty($data['password'])) { $user->password = password_hash($data['password'], PASSWORD_DEFAULT); $user->password_algo = null; (new AuthService($user))->removeAllSessions(); }
                $user->save();
            }
            $profile->fill(['permissions' => $data['permissions'], 'allowed_ips' => array_values($data['allowed_ips'] ?? []), 'expires_at' => strtotime($data['expires_at']), 'max_logins' => $data['max_logins'], 'active' => $data['active']]);
            $profile->save();
            if (!$data['active']) (new AuthService($profile->user))->removeAllSessions();
        });
        return $this->success(['profile' => $profile->fresh('user:id,email,last_login_at'), 'generated_password' => $generated]);
    }

    public function revoke(Request $request)
    {
        $profile = AdminAccessProfile::findOrFail($request->validate(['id' => 'required|integer'])['id']);
        $profile->update(['active' => false]); (new AuthService($profile->user))->removeAllSessions();
        return $this->success(true);
    }

    public function destroy(Request $request)
    {
        $profile = AdminAccessProfile::findOrFail($request->validate(['id' => 'required|integer'])['id']);
        DB::transaction(function () use ($profile) { $user = $profile->user; (new AuthService($user))->removeAllSessions(); $profile->delete(); $user->delete(); });
        return $this->success(true);
    }
}
