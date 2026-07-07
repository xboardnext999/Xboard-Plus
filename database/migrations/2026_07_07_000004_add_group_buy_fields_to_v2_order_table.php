<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('v2_order', function (Blueprint $table) {
            if (!Schema::hasColumn('v2_order', 'group_buy_activity_id')) {
                $table->integer('group_buy_activity_id')->nullable()->index()->after('coupon_id');
            }
            if (!Schema::hasColumn('v2_order', 'group_buy_group_id')) {
                $table->integer('group_buy_group_id')->nullable()->index()->after('group_buy_activity_id');
            }
            if (!Schema::hasColumn('v2_order', 'group_buy_discount_amount')) {
                $table->integer('group_buy_discount_amount')->default(0)->after('group_buy_group_id');
            }
        });
    }

    public function down(): void
    {
        Schema::table('v2_order', function (Blueprint $table) {
            if (Schema::hasColumn('v2_order', 'group_buy_discount_amount')) {
                $table->dropColumn('group_buy_discount_amount');
            }
            if (Schema::hasColumn('v2_order', 'group_buy_group_id')) {
                $table->dropColumn('group_buy_group_id');
            }
            if (Schema::hasColumn('v2_order', 'group_buy_activity_id')) {
                $table->dropColumn('group_buy_activity_id');
            }
        });
    }
};
