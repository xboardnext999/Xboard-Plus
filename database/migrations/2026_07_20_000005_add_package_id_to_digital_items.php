<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (!Schema::hasTable('v2_digital_product_item') || Schema::hasColumn('v2_digital_product_item', 'package_id')) return;
        Schema::table('v2_digital_product_item', function (Blueprint $table) {
            $table->string('package_id', 64)->nullable()->after('plan_id')->index();
        });
    }
    public function down(): void
    {
        if (Schema::hasTable('v2_digital_product_item') && Schema::hasColumn('v2_digital_product_item', 'package_id')) {
            Schema::table('v2_digital_product_item', fn(Blueprint $table) => $table->dropColumn('package_id'));
        }
    }
};
