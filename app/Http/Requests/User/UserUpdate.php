<?php

namespace App\Http\Requests\User;

use Illuminate\Foundation\Http\FormRequest;

class UserUpdate extends FormRequest
{
    /**
     * Get the validation rules that apply to the request.
     *
     * @return array
     */
    public function rules()
    {
        return [
            'name' => 'nullable|string|max:64',
            'avatar' => 'nullable|string|max:255',
            'remind_expire' => 'in:0,1',
            'remind_traffic' => 'in:0,1'
        ];
    }

    public function messages()
    {
        return [
            'name.max' => __('Nickname may not be greater than 64 characters'),
            'avatar.max' => __('Avatar address may not be greater than 255 characters'),
            'remind_expire.in' => __('Incorrect format of expiration reminder'),
            'remind_traffic.in' => __('Incorrect traffic alert format')
        ];
    }
}
