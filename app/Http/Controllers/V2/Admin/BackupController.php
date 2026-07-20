<?php

namespace App\Http\Controllers\V2\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\File;

class BackupController extends Controller
{
    public function index()
    {
        $dir = storage_path('backup'); File::ensureDirectoryExists($dir);
        $files = collect(File::files($dir))->filter(fn($f) => str_ends_with($f->getFilename(), '.gz'))->map(fn($f) => [
            'name' => $f->getFilename(), 'size' => $f->getSize(), 'created_at' => $f->getMTime(), 'sha256' => hash_file('sha256', $f->getPathname()),
        ])->sortByDesc('created_at')->values();
        return $this->success(['files' => $files, 'settings' => ['enabled' => (bool) admin_setting('auto_backup_enabled', 0), 'time' => admin_setting('auto_backup_time', '03:30'), 'retention' => (int) admin_setting('backup_retention', 14)]]);
    }
    public function create()
    {
        if (!Cache::add('admin:backup:running', 1, 600)) return response()->json(['message' => '已有备份任务正在执行'], 409);
        try { set_time_limit(600); $code = Artisan::call('backup:database'); if ($code !== 0) return response()->json(['message' => '备份失败，请检查备份日志'], 500); }
        finally { Cache::forget('admin:backup:running'); }
        return $this->success(true);
    }
    public function saveSettings(Request $request)
    {
        $data = $request->validate(['enabled' => 'required|boolean', 'time' => 'required|date_format:H:i', 'retention' => 'required|integer|min:1|max:365']);
        admin_setting(['auto_backup_enabled' => $data['enabled'] ? 1 : 0, 'auto_backup_time' => $data['time'], 'backup_retention' => $data['retention']]);
        return $this->success(true);
    }
}
