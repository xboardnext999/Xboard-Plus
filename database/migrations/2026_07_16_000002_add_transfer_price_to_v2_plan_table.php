<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('v2_plan') || Schema::hasColumn('v2_plan', 'transfer_price')) {
            return;
        }

        Schema::table('v2_plan', function (Blueprint $table) {
            $table->unsignedInteger('transfer_price')
                ->nullable()
                ->after('prices')
                ->comment('套餐转让费用（分），NULL 继承系统默认费用');
        });
    }

    public function down(): void
    {
        if (!Schema::hasTable('v2_plan') || !Schema::hasColumn('v2_plan', 'transfer_price')) {
            return;
        }

        Schema::table('v2_plan', function (Blueprint $table) {
            $table->dropColumn('transfer_price');
        });
    }
};
