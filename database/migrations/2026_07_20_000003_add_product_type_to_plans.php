<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (!Schema::hasTable('v2_plan') || Schema::hasColumn('v2_plan', 'product_type')) return;
        Schema::table('v2_plan', function (Blueprint $table) {
            $table->string('product_type', 24)->default('subscription')->after('name')->index();
            $table->json('product_config')->nullable()->after('product_type');
        });
    }

    public function down(): void
    {
        if (!Schema::hasTable('v2_plan') || !Schema::hasColumn('v2_plan', 'product_type')) return;
        Schema::table('v2_plan', function (Blueprint $table) {
            $table->dropColumn(['product_type', 'product_config']);
        });
    }
};
