<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;

class FollowController extends Controller
{
    public function toggle(User $user, Request $request)
    {
        $currentUser = $request->user();

        if ($currentUser->id === $user->id) {
            return response()->json([
                'message' => 'You cannot follow yourself',
            ], 400);
        }

        $follow = $currentUser->following()
            ->where('following_id', $user->id)
            ->first();

        if ($follow) {
            // Unfollow
            $follow->delete();
            $following = false;
        } else {
            // Follow
            $currentUser->following()->create([
                'following_id' => $user->id,
            ]);
            $following = true;
        }

        $user->loadCount(['followers', 'following']);

        return response()->json([
            'following' => $following,
            'followers_count' => $user->followers_count,
            'following_count' => $user->following_count,
        ]);
    }
}
