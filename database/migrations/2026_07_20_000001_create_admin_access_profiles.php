<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('v2_admin_access_profile', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id')->unique();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->json('permissions');
            $table->json('allowed_ips')->nullable();
            $table->unsignedInteger('expires_at')->index();
            $table->unsignedInteger('max_logins')->default(10);
            $table->unsignedInteger('login_count')->default(0);
            $table->boolean('active')->default(true)->index();
            $table->unsignedInteger('created_at');
            $table->unsignedInteger('updated_at');
        });
    }
    public function down(): void { Schema::dropIfExists('v2_admin_access_profile'); }
};
