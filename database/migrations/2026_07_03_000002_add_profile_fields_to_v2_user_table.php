<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('v2_user')) {
            return;
        }

        Schema::table('v2_user', function (Blueprint $table) {
            if (!Schema::hasColumn('v2_user', 'name')) {
                $table->string('name', 64)->nullable();
            }

            if (!Schema::hasColumn('v2_user', 'avatar')) {
                $table->string('avatar', 255)->nullable();
            }
        });
    }

    public function down(): void
    {
        if (!Schema::hasTable('v2_user')) {
            return;
        }

        Schema::table('v2_user', function (Blueprint $table) {
            if (Schema::hasColumn('v2_user', 'avatar')) {
                $table->dropColumn('avatar');
            }

            if (Schema::hasColumn('v2_user', 'name')) {
                $table->dropColumn('name');
            }
        });
    }
};
