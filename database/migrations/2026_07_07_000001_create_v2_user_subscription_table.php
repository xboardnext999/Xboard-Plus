<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (Schema::hasTable('v2_user_subscription')) {
            return;
        }

        Schema::create('v2_user_subscription', function (Blueprint $table) {
            $table->integer('id', true);
            $table->integer('user_id')->index();
            $table->integer('plan_id')->index();
            $table->integer('order_id')->nullable()->index();
            $table->integer('group_id')->nullable()->index();
            $table->string('period', 32)->nullable();
            $table->bigInteger('transfer_enable')->default(0)->comment('套餐总流量，单位 bytes');
            $table->bigInteger('used_traffic')->default(0)->comment('预留字段，当前仍以用户全局流量为准');
            $table->integer('speed_limit')->nullable();
            $table->integer('device_limit')->nullable();
            $table->integer('started_at')->nullable();
            $table->integer('expired_at')->nullable()->index();
            $table->tinyInteger('status')->default(1)->index()->comment('1启用 2冻结 3过期 4取消');
            $table->boolean('is_primary')->default(false)->index();
            $table->integer('frozen_at')->nullable();
            $table->integer('freeze_ends_at')->nullable();
            $table->integer('freeze_used_days')->default(0);
            $table->integer('freeze_count')->default(0);
            $table->json('metadata')->nullable();
            $table->integer('created_at');
            $table->integer('updated_at');

            $table->index(['user_id', 'status', 'expired_at'], 'idx_user_subscription_available');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('v2_user_subscription');
    }
};
