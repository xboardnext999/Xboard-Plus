<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('v2_digital_product_faq', function (Blueprint $table): void {
            $table->id();
            $table->string('title', 150);
            $table->text('content');
            $table->boolean('enabled')->default(true)->index();
            $table->unsignedInteger('sort')->default(0)->index();
            $table->integer('created_at');
            $table->integer('updated_at');
        });

        $now = time();
        DB::table('v2_digital_product_faq')->insert([
            ['title' => '购买后如何交付？', 'content' => '自动交付商品会在支付完成后写入订单详情；人工交付商品请留意订单状态和站内通知。', 'enabled' => true, 'sort' => 1, 'created_at' => $now, 'updated_at' => $now],
            ['title' => '在哪里查看已购买内容？', 'content' => '在订单查询中输入订单号，或进入“我的订单”打开对应订单，即可查看交付内容。', 'enabled' => true, 'sort' => 2, 'created_at' => $now, 'updated_at' => $now],
            ['title' => '支付成功但没有收到商品？', 'content' => '请先刷新订单详情。若仍未显示，请保留订单号并通过工单联系管理员处理。', 'enabled' => true, 'sort' => 3, 'created_at' => $now, 'updated_at' => $now],
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('v2_digital_product_faq');
    }
};
