<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (Schema::hasTable('v2_recharge')) {
            return;
        }

        Schema::create('v2_recharge', function (Blueprint $table) {
            $table->integer('id', true);
            $table->integer('user_id')->index();
            $table->integer('payment_id')->nullable();
            $table->string('trade_no', 36)->unique('trade_no');
            $table->string('callback_no')->nullable();
            $table->integer('amount')->comment('充值到账金额');
            $table->integer('handling_amount')->nullable()->comment('手续费');
            $table->tinyInteger('status')->default(0)->comment('0待支付1处理中2已取消3已完成');
            $table->integer('paid_at')->nullable();
            $table->integer('created_at');
            $table->integer('updated_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('v2_recharge');
    }
};
