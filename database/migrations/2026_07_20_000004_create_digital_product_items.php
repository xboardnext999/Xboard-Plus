<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        // 若首次执行在外键创建阶段中断，清理不完整的空表后重试。
        if (Schema::hasTable('v2_digital_product_item')) Schema::dropIfExists('v2_digital_product_item');
        Schema::create('v2_digital_product_item', function (Blueprint $table) {
            $table->id();
            // v2_plan 使用有符号 INT 主键，必须保持类型一致才能创建外键。
            $table->integer('plan_id')->index();
            $table->text('content');
            $table->string('status', 16)->default('available')->index();
            $table->unsignedInteger('order_id')->nullable()->index();
            $table->unsignedInteger('user_id')->nullable()->index();
            $table->unsignedInteger('sold_at')->nullable();
            $table->unsignedInteger('created_at')->nullable();
            $table->unsignedInteger('updated_at')->nullable();
            $table->foreign('plan_id')->references('id')->on('v2_plan')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('v2_digital_product_item');
    }
};
