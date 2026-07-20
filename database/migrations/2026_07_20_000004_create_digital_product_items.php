<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (Schema::hasTable('v2_digital_product_item')) return;
        Schema::create('v2_digital_product_item', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('plan_id')->index();
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
