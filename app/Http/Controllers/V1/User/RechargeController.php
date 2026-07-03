<?php

namespace App\Http\Controllers\V1\User;

use App\Exceptions\ApiException;
use App\Http\Controllers\Controller;
use App\Http\Resources\RechargeResource;
use App\Models\Payment;
use App\Models\Recharge;
use App\Models\User;
use App\Services\PaymentService;
use App\Services\RechargeService;
use Illuminate\Http\Request;

class RechargeController extends Controller
{
    public function fetch(Request $request)
    {
        $request->validate([
            'status' => 'nullable|integer|in:0,1,2,3',
        ]);

        $records = Recharge::with('payment')
            ->where('user_id', $request->user()->id)
            ->when($request->input('status') !== null, function ($query) use ($request) {
                $query->where('status', $request->input('status'));
            })
            ->orderBy('created_at', 'DESC')
            ->limit(50)
            ->get();

        return $this->success(RechargeResource::collection($records));
    }

    public function detail(Request $request)
    {
        $request->validate([
            'trade_no' => 'required|string',
        ]);

        $recharge = Recharge::with('payment')
            ->where('user_id', $request->user()->id)
            ->where('trade_no', $request->input('trade_no'))
            ->first();

        if (!$recharge) {
            return $this->fail([400, __('Recharge record does not exist')]);
        }

        return $this->success(RechargeResource::make($recharge));
    }

    public function save(Request $request)
    {
        $request->validate([
            'amount' => 'required|numeric|min:0.01|max:100000',
        ]);

        $user = User::findOrFail($request->user()->id);
        $pending = Recharge::where('user_id', $user->id)
            ->whereIn('status', [Recharge::STATUS_PENDING, Recharge::STATUS_PROCESSING])
            ->first();

        if ($pending) {
            throw new ApiException(__('You have an unpaid recharge, please pay or cancel it first'));
        }

        $amount = (int) round(((float) $request->input('amount')) * 100);
        $recharge = RechargeService::create($user, $amount);

        return $this->success($recharge->trade_no);
    }

    public function checkout(Request $request)
    {
        $request->validate([
            'trade_no' => 'required|string',
            'method' => 'required|integer',
        ]);

        $tradeNo = $request->input('trade_no');
        $method = $request->input('method');
        $recharge = Recharge::where('trade_no', $tradeNo)
            ->where('user_id', $request->user()->id)
            ->where('status', Recharge::STATUS_PENDING)
            ->first();

        if (!$recharge) {
            return $this->fail([400, __('Recharge record does not exist or has been paid')]);
        }

        $payment = Payment::find($method);
        if (!$payment || !$payment->enable) {
            return $this->fail([400, __('Payment method is not available')]);
        }

        $paymentService = new PaymentService($payment->payment, $payment->id);
        $recharge->handling_amount = null;
        if ($payment->handling_fee_fixed || $payment->handling_fee_percent) {
            $recharge->handling_amount = (int) round(($recharge->amount * ($payment->handling_fee_percent / 100)) + $payment->handling_fee_fixed);
        }
        $recharge->payment_id = $method;

        if (!$recharge->save()) {
            return $this->fail([400, __('Request failed, please try again later')]);
        }

        $result = $paymentService->pay([
            'trade_no' => $tradeNo,
            'total_amount' => $recharge->amount + (int) ($recharge->handling_amount ?? 0),
            'user_id' => $recharge->user_id,
            'stripe_token' => $request->input('token'),
            'return_url' => source_base_url('/recharge?trade_no=' . $tradeNo),
        ]);

        return response([
            'type' => $result['type'],
            'data' => $result['data'],
        ]);
    }

    public function check(Request $request)
    {
        $request->validate([
            'trade_no' => 'required|string',
        ]);

        $recharge = Recharge::where('trade_no', $request->input('trade_no'))
            ->where('user_id', $request->user()->id)
            ->first();

        if (!$recharge) {
            return $this->fail([400, __('Recharge record does not exist')]);
        }

        return $this->success($recharge->status);
    }

    public function cancel(Request $request)
    {
        $request->validate([
            'trade_no' => 'required|string',
        ]);

        $recharge = Recharge::where('trade_no', $request->input('trade_no'))
            ->where('user_id', $request->user()->id)
            ->first();

        if (!$recharge) {
            return $this->fail([400, __('Recharge record does not exist')]);
        }

        if ($recharge->status !== Recharge::STATUS_PENDING) {
            return $this->fail([400, __('You can only cancel pending recharges')]);
        }

        if (!(new RechargeService($recharge))->cancel()) {
            return $this->fail([400, __('Cancel failed')]);
        }

        return $this->success(true);
    }

    public function getPaymentMethod()
    {
        $methods = Payment::select([
            'id',
            'name',
            'payment',
            'icon',
            'handling_fee_fixed',
            'handling_fee_percent',
        ])
            ->where('enable', 1)
            ->orderBy('sort', 'ASC')
            ->get();

        return $this->success($methods);
    }
}
