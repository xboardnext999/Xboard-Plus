<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (!Schema::hasTable('v2_group_buy_activity')) {
            Schema::create('v2_group_buy_activity', function (Blueprint $table) {
                $table->integer('id', true);
                $table->integer('plan_id')->index();
                $table->string('period', 32)->index();
                $table->string('title', 120);
                $table->integer('group_size')->default(2);
                $table->tinyInteger('discount_type')->default(2)->comment('1固定金额 2百分比');
                $table->integer('discount_value')->default(0)->comment('固定金额为分，百分比为 1-100');
                $table->integer('started_at')->nullable();
                $table->integer('ended_at')->nullable();
                $table->integer('expire_minutes')->default(1440);
                $table->tinyInteger('status')->default(1)->index()->comment('1启用 0停用');
                $table->integer('created_at');
                $table->integer('updated_at');
            });
        }

        if (!Schema::hasTable('v2_group_buy_group')) {
            Schema::create('v2_group_buy_group', function (Blueprint $table) {
                $table->integer('id', true);
                $table->integer('activity_id')->index();
                $table->integer('leader_user_id')->index();
                $table->tinyInteger('status')->default(1)->index()->comment('1拼团中 2已成团 3已过期');
                $table->integer('required_count')->default(2);
                $table->integer('current_count')->default(0);
                $table->integer('expired_at')->nullable()->index();
                $table->integer('created_at');
                $table->integer('updated_at');
            });
        }

        if (!Schema::hasTable('v2_group_buy_member')) {
            Schema::create('v2_group_buy_member', function (Blueprint $table) {
                $table->integer('id', true);
                $table->integer('group_id')->index();
                $table->integer('user_id')->index();
                $table->integer('order_id')->nullable()->index();
                $table->tinyInteger('status')->default(1)->index()->comment('1已加入 2已支付');
                $table->integer('created_at');
                $table->integer('updated_at');

                $table->unique(['group_id', 'user_id'], 'uniq_group_buy_group_user');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('v2_group_buy_member');
        Schema::dropIfExists('v2_group_buy_group');
        Schema::dropIfExists('v2_group_buy_activity');
    }
};
