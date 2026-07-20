<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class ResetAdminLock extends Command
{
    protected $signature = 'admin-lock:reset {--disable : Disable access verification instead of generating new passwords}';
    protected $description = 'Reset or disable the admin access verification credentials';

    public function handle(): int
    {
        if ($this->option('disable')) {
            admin_setting(['admin_lock_enabled' => 0, 'admin_lock_version' => Str::random(24)]);
            $this->warn('Admin access verification has been disabled.');
            return self::SUCCESS;
        }

        $passwordA = Str::random(24);
        $passwordB = Str::random(32);
        admin_setting([
            'admin_lock_enabled' => 1,
            'admin_lock_simple_hash' => Hash::make($passwordA),
            'admin_lock_full_hash' => Hash::make($passwordB),
            'admin_lock_version' => Str::random(24),
        ]);

        $this->info('Admin access verification credentials were reset. Save them now; they cannot be displayed again.');
        $this->line('Password A: ' . $passwordA);
        $this->line('Password B: ' . $passwordB);
        return self::SUCCESS;
    }
}
