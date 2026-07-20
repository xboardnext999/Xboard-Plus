<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('v2_order', function (Blueprint $table) {
            if (!Schema::hasColumn('v2_order', 'digital_cart_items')) {
                $table->text('digital_cart_items')->nullable()->after('surplus_order_ids')->comment('数字商品购物车明细');
            }
        });
    }

    public function down(): void
    {
        Schema::table('v2_order', function (Blueprint $table) {
            if (Schema::hasColumn('v2_order', 'digital_cart_items')) {
                $table->dropColumn('digital_cart_items');
            }
        });
    }
};
