<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class ProfileController extends Controller
{
    public function show(User $user)
    {
        $user->loadCount(['posts', 'followers', 'following']);

        return response()->json($user);
    }

    public function update(Request $request)
    {
        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'bio' => 'nullable|string|max:500',
            'avatar' => 'nullable|image|max:2048', // 2MB max
        ]);

        $user = $request->user();

        if ($request->hasFile('avatar')) {
            // Delete old avatar if exists
            if ($user->avatar_url) {
                $path = parse_url($user->avatar_url, PHP_URL_PATH);
                $path = ltrim($path, '/');
                Storage::disk('s3')->delete($path);
            }

            // Upload new avatar
            $path = $request->file('avatar')->store('avatars', 's3');
            $validated['avatar_url'] = Storage::disk('s3')->url($path);
        }

        $user->update($validated);

        return response()->json($user);
    }
}
